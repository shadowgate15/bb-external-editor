import 'reflect-metadata'

import { CityName, CorpEmployeePosition, Office } from '@ns'
import { inject, injectable } from 'inversify'
import { combineLatest, EMPTY, filter, first, map, mergeMap, Observable, switchMap, tap } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { Config } from './config'
import { Corporation } from './corporation'
import { Divisions } from './divisions'
import { Offices } from './offices'

/** The 5 productive employee positions (excludes Intern and Unassigned). */
export const PRODUCTIVE_POSITIONS: CorpEmployeePosition[] = [
  'Operations',
  'Engineer',
  'Business',
  'Management',
  'Research & Development',
]

/** Coefficient rows for the linear system [I, A, C, E] per job, matching {@link PRODUCTIVE_POSITIONS} order. */
const JOB_COEFFICIENTS: Record<CorpEmployeePosition, [number, number, number, number]> = {
  Operations: [0.6, 0.1, 0.5, 1.0],
  Engineer: [1.0, 0.1, 0.0, 1.0],
  Business: [0.4, 1.0, 0.0, 0.0],
  Management: [0.0, 2.0, 0.2, 0.7],
  'Research & Development': [1.5, 0.0, 1.0, 0.5],
  Intern: [0, 0, 0, 0],
  Unassigned: [0, 0, 0, 0],
}

/** Coefficient on the `Exp` term in each job's production multiplier formula. */
const JOB_EXP_COEFFICIENTS: Record<CorpEmployeePosition, number> = {
  Operations: 1.0,
  Engineer: 1.5,
  Business: 0.5,
  Management: 1.0,
  'Research & Development': 0.8,
  Intern: 0,
  Unassigned: 0,
}

/** Recovered hidden employee stat multipliers. Each is the product of avg stat, upgrade benefit, and research benefit. */
export interface EmployeeStats {
  intelligence: number
  charisma: number
  creativity: number
  efficiency: number
}

/**
 * Solve a 4×4 linear system Ax = b using Gaussian elimination with partial pivoting.
 *
 * @param A - 4×4 coefficient matrix (row-major).
 * @param b - 4-element RHS vector.
 * @returns Solution vector [x0, x1, x2, x3], or `null` if the system is singular.
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = 4
  // Augmented matrix [A | b]
  const m: number[][] = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    // Partial pivoting: find the row with the largest absolute value in this column
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[maxRow][col])) maxRow = row
    }
    ;[m[col], m[maxRow]] = [m[maxRow], m[col]]

    if (Math.abs(m[col][col]) < 1e-12) return null

    // Eliminate below the pivot
    for (let row = col + 1; row < n; row++) {
      const factor = m[row][col] / m[col][col]
      for (let k = col; k <= n; k++) {
        m[row][k] -= factor * m[col][k]
      }
    }
  }

  // Back substitution
  const x = new Array<number>(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = m[i][n]
    for (let j = i + 1; j < n; j++) {
      x[i] -= m[i][j] * x[j]
    }
    x[i] /= m[i][i]
  }

  return x
}

/**
 * Recover hidden employee stat multipliers (Intelligence, Charisma, Creativity, Efficiency)
 * from the observable `office.employeeProductionByJob` values using Gaussian elimination.
 *
 * Requires at least 4 of the 5 productive positions to have ≥ 1 employee assigned.
 * The first 4 populated positions are used to form an exact 4×4 system.
 *
 * @param office - The current office snapshot containing employee production and job counts.
 * @param exp - Average employee experience: `totalExperience / numEmployees`.
 * @param base - Production base: `avgMorale * avgEnergy * 1e-4`.
 * @returns Recovered {@link EmployeeStats}, or `null` if fewer than 4 jobs are populated.
 */
export function solveEmployeeStats(office: Office, exp: number, base: number): EmployeeStats | null {
  const populated = PRODUCTIVE_POSITIONS.filter((pos) => (office.employeeJobs[pos] ?? 0) > 0)
  if (office.numEmployees === 0 || populated.length < 4) return null

  const rows = populated.slice(0, 4)

  const A: number[][] = rows.map((pos) => [...JOB_COEFFICIENTS[pos]])
  const b: number[] = rows.map((pos) => {
    const count = office.employeeJobs[pos]
    const observed = office.employeeProductionByJob[pos] ?? 0
    const p = base > 0 ? observed / (count * base) : 0
    return p - JOB_EXP_COEFFICIENTS[pos] * exp
  })

  const solution = solveLinearSystem(A, b)
  if (solution === null) return null

  return {
    intelligence: solution[0],
    charisma: solution[1],
    creativity: solution[2],
    efficiency: solution[3],
  }
}

/**
 * Compute the per-employee production rate for each of the 5 productive job positions
 * given recovered employee stats, average experience, and the production base.
 *
 * These rates represent how much production one employee contributes in each role:
 * `rate_j = base * ProductionMultiplier_j(stats, exp)`.
 *
 * @param stats - Recovered employee stat multipliers.
 * @param exp - Average employee experience: `totalExperience / numEmployees`.
 * @param base - Production base: `avgMorale * avgEnergy * 1e-4`.
 * @returns Map of each productive position to its per-employee production rate.
 */
export function computeJobProductionRates(
  stats: EmployeeStats,
  exp: number,
  base: number,
): Record<CorpEmployeePosition, number> {
  const { intelligence: I, charisma: A, creativity: C, efficiency: E } = stats
  return {
    Operations: base * (0.6 * I + 0.1 * A + exp + 0.5 * C + E),
    Engineer: base * (I + 0.1 * A + 1.5 * exp + E),
    Business: base * (0.4 * I + A + 0.5 * exp),
    Management: base * (2 * A + exp + 0.2 * C + 0.7 * E),
    'Research & Development': base * (1.5 * I + 0.8 * exp + C + 0.5 * E),
    Intern: 0,
    Unassigned: 0,
  }
}

/** Per-job weight configuration used by the optimizer. */
export interface JobWeights {
  operations: number
  engineer: number
  business: number
  management: number
  research: number
}

/** Default job weights that balance production and research. */
export const DEFAULT_JOB_WEIGHTS: JobWeights = {
  operations: 1,
  engineer: 1,
  business: 0.5,
  management: 0.5,
  research: 1,
}

/**
 * Map a {@link JobWeights} object to the keyed format used by the position record.
 *
 * @param weights - The weight configuration.
 * @returns Partial record mapping each productive position to its weight.
 */
function weightsToPositionMap(weights: JobWeights): Record<CorpEmployeePosition, number> {
  return {
    Operations: weights.operations,
    Engineer: weights.engineer,
    Business: weights.business,
    Management: weights.management,
    'Research & Development': weights.research,
    Intern: 0,
    Unassigned: 0,
  }
}

/**
 * Compute the optimal number of employees to assign to each productive job position.
 *
 * Effective value per job: `effectiveValue_j = weights[j] * rates[j]`.
 * Each position receives a share of `numEmployees` proportional to its effective value.
 * Rounding remainders are assigned to the position with the highest effective value.
 *
 * @param numEmployees - Total number of employees available to assign.
 * @param rates - Per-employee production rate for each position (from {@link computeJobProductionRates}).
 * @param weights - Relative importance weight for each production type.
 * @returns Record mapping each productive position to its target employee count.
 */
export function computeOptimalJobAssignment(
  numEmployees: number,
  rates: Record<CorpEmployeePosition, number>,
  weights: JobWeights,
): Record<CorpEmployeePosition, number> {
  const weightMap = weightsToPositionMap(weights)
  const effectiveValues = PRODUCTIVE_POSITIONS.map((pos) => ({
    pos,
    value: weightMap[pos] * rates[pos],
  }))

  const totalValue = effectiveValues.reduce((sum, { value }) => sum + value, 0)

  // Compute floor allocations and track remainders for rounding
  let assigned = 0
  const counts: Record<CorpEmployeePosition, number> = {
    Operations: 0,
    Engineer: 0,
    Business: 0,
    Management: 0,
    'Research & Development': 0,
    Intern: 0,
    Unassigned: 0,
  }

  if (totalValue <= 0) {
    // Edge case: all weights or rates are zero — distribute evenly
    const base = Math.floor(numEmployees / PRODUCTIVE_POSITIONS.length)
    const remainder = numEmployees - base * PRODUCTIVE_POSITIONS.length
    for (const pos of PRODUCTIVE_POSITIONS) counts[pos] = base
    counts[PRODUCTIVE_POSITIONS[0]] += remainder
    return counts
  }

  const remainders: { pos: CorpEmployeePosition; remainder: number }[] = []

  for (const { pos, value } of effectiveValues) {
    const exact = (numEmployees * value) / totalValue
    const floored = Math.floor(exact)
    counts[pos] = floored
    assigned += floored
    remainders.push({ pos, remainder: exact - floored })
  }

  // Distribute remaining employees to positions with the largest fractional remainders
  const remaining = numEmployees - assigned
  remainders.sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < remaining; i++) {
    counts[remainders[i].pos]++
  }

  return counts
}

/**
 * Returns `true` if any productive position's count differs between `current` and `target`.
 *
 * @param current - Current `office.employeeJobs` record.
 * @param target - Target assignment computed by {@link computeOptimalJobAssignment}.
 * @returns Whether the assignments differ and an update is needed.
 */
export function jobAssignmentsDiffer(
  current: Office['employeeJobs'],
  target: Record<CorpEmployeePosition, number>,
): boolean {
  return PRODUCTIVE_POSITIONS.some((pos) => (current[pos] ?? 0) !== target[pos])
}

/**
 * Reactive service that assigns employees to optimal job positions each cycle to balance
 * production and research output.
 *
 * Enabled only when `config.enableOptimizeJobs` is `true`. When enabled, fires on each
 * **SALE** phase (when `nextState` is `START`) and for every active division × city:
 * 1. Recovers hidden employee stat multipliers via {@link solveEmployeeStats}.
 * 2. Computes the optimal job distribution via {@link computeOptimalJobAssignment}.
 * 3. Skips cities where fewer than 4 productive positions are populated (solver underdetermined).
 * 4. Applies changes only when the target distribution differs from current assignments:
 *    first clears all productive positions to 0, then sets the new counts.
 */
@injectable('Singleton')
export class OptimizeJobs {
  /**
   * Inner observable that fires once per START state, emitting one assignment action per division × city.
   * Active only while `config.enableOptimizeJobs` is `true`.
   */
  private readonly _innerOptimize$: Observable<void> = this.corporation.nextState$().pipe(
    // only act when START is the upcoming state (we are currently in SALE)
    filter((state) => state === 'START'),
    tap(() => this.ns.print('INFO Optimize Jobs: computing job assignments...')),
    switchMap(() => this.divisions.eachDivisionNameAndCityName$()),
    mergeMap(({ divisionName, cityName }) => this._processCity$(divisionName, cityName)),
  )

  /**
   * Observable that runs the job optimization loop while `config.enableOptimizeJobs` is `true`.
   * Automatically starts and stops as the config flag changes.
   */
  readonly optimizeJobs$: Observable<void> = this.config.data$().pipe(
    // toggle inner loop based on config flag
    switchMap((c) => (c.enableOptimizeJobs ? this._innerOptimize$ : EMPTY)),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Corporation)
    private readonly corporation: Corporation,

    @inject(Config)
    private readonly config: Config,

    @inject(Divisions)
    private readonly divisions: Divisions,

    @inject(Offices)
    private readonly offices: Offices,
  ) {}

  /** Subscribe to {@link optimizeJobs$} to start the job optimization loop. */
  start() {
    this.optimizeJobs$.subscribe()
  }

  /**
   * Process one division × city: compute the optimal job assignment and apply it if changed.
   *
   * @param divisionName - The division to process.
   * @param cityName - The city to process.
   * @returns Observable that completes after assignments are applied (or skipped).
   */
  private _processCity$(divisionName: string, cityName: CityName): Observable<void> {
    return combineLatest({
      office: this.offices.infoFor$(divisionName, cityName),
      config: this.config.data$().pipe(first()),
    }).pipe(
      first(),
      map(({ office, config }) => {
        if (office.numEmployees === 0) return

        const exp = office.totalExperience / office.numEmployees
        const base = office.avgMorale * office.avgEnergy * 1e-4

        const stats = solveEmployeeStats(office, exp, base)
        if (stats === null) {
          this.ns.print(
            `WARN Optimize Jobs: skipping ${divisionName}/${cityName} — fewer than 4 productive positions are staffed`,
          )
          return
        }

        const rates = computeJobProductionRates(stats, exp, base)
        const weights = config.jobProductionWeights
        const target = computeOptimalJobAssignment(office.numEmployees, rates, weights)

        if (!jobAssignmentsDiffer(office.employeeJobs, target)) return

        // Clear all productive positions before re-assigning to avoid constraint violations
        for (const pos of PRODUCTIVE_POSITIONS) {
          this.ns.corporation.setAutoJobAssignment(divisionName, cityName, pos, 0)
        }
        for (const pos of PRODUCTIVE_POSITIONS) {
          if (target[pos] > 0) {
            this.ns.corporation.setAutoJobAssignment(divisionName, cityName, pos, target[pos])
          }
        }
      }),
    )
  }
}
