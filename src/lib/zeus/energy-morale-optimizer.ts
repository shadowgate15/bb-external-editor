import 'reflect-metadata'

import { CityName } from '@ns'
import { inject, injectable } from 'inversify'
import { combineLatest, EMPTY, filter, first, map, mergeMap, Observable, switchMap, tap } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { Config } from './config'
import { Corporation } from './corporation'
import { Divisions } from './divisions'
import { Offices } from './offices'

/** Minimum number of employees at which energy and morale begin to naturally decay each cycle. */
const DECAY_THRESHOLD = 9

/**
 * Compute the optimal cost-per-employee to throw a party that raises morale from
 * `currentMorale` to `targetMorale` in a single cycle.
 *
 * The in-game morale update formula (ignoring the negligible random flat decay) is:
 *
 * ```
 * newMorale = (currentMorale × perfMult + x / 10⁶) × (1 + x / 10⁷)
 * ```
 *
 * where `x = PartyCostPerEmployee` and `perfMult ≈ 1.0`.
 *
 * Expanding and collecting into standard quadratic form `Ax² + Bx + C = 0`:
 * - A = 1
 * - B = perfMult × currentMorale × 10⁶ + 10⁷
 * - C = (perfMult × currentMorale − targetMorale) × 10¹³
 *
 * The positive root is taken since cost must be non-negative.
 *
 * @param currentMorale - The office's current average morale.
 * @param targetMorale - The desired average morale after the party.
 * @param perfMult - Performance multiplier (≈ 1.0 since decay is ≤ 0.002/cycle).
 * @returns The optimal `PartyCostPerEmployee` (≥ 0). Returns 0 when already at or above target.
 */
export function computeOptimalPartyCost(currentMorale: number, targetMorale: number, perfMult = 1): number {
  const adjustedMorale = currentMorale * perfMult
  if (adjustedMorale >= targetMorale) return 0

  // Quadratic coefficients after expanding (adjustedMorale + x/1e6) * (1 + x/1e7) = targetMorale
  const A = 1
  const B = adjustedMorale * 1e6 + 1e7
  const C = (adjustedMorale - targetMorale) * 1e13

  const discriminant = B * B - 4 * A * C
  return (-B + Math.sqrt(discriminant)) / (2 * A)
}

/**
 * Reactive service that buys tea and throws parties each cycle to keep employee
 * energy and morale at their maximum values.
 *
 * Fires on each **SALE** phase (when `nextState` is `START`) and for every active
 * division × city where `numEmployees ≥ {@link DECAY_THRESHOLD}`:
 *
 * 1. **Tea**: calls `ns.corporation.buyTea` whenever `avgEnergy < maxEnergy` (+2 flat energy).
 * 2. **Party**: computes the optimal `PartyCostPerEmployee` via {@link computeOptimalPartyCost}
 *    to raise morale by up to `config.moraleStepSize` toward `maxMorale`, then calls
 *    `ns.corporation.throwParty`. Using a step-capped target is more cost-efficient than
 *    a single large jump (quadratic cost structure).
 */
@injectable('Singleton')
export class EnergyMoraleOptimizer {
  /**
   * Inner observable that fires once per START state, emitting one optimization action
   * per division × city. Active only while `config.enableEnergyMoraleOptimizer` is `true`.
   */
  private readonly _innerOptimize$: Observable<void> = this.corporation.nextState$().pipe(
    // only act when START is the upcoming state (we are currently in SALE)
    filter((state) => state === 'START'),
    tap(() => this.ns.print('INFO Energy/Morale Optimizer: running...')),
    switchMap(() => this.divisions.eachDivisionNameAndCityName$()),
    mergeMap(({ divisionName, cityName }) => this._processOffice$(divisionName, cityName)),
  )

  /**
   * Observable that runs the energy/morale optimization loop while
   * `config.enableEnergyMoraleOptimizer` is `true`. Automatically starts and stops
   * as the config flag changes.
   */
  readonly optimizeEnergyMorale$: Observable<void> = this.config.data$().pipe(
    // toggle inner loop based on config flag
    switchMap((c) => (c.enableEnergyMoraleOptimizer ? this._innerOptimize$ : EMPTY)),
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

  /** Subscribe to {@link optimizeEnergyMorale$} to start the optimization loop. */
  start() {
    this.optimizeEnergyMorale$.subscribe()
  }

  /**
   * Process one division × city: buy tea and/or throw a party as needed.
   *
   * Skips offices with fewer than {@link DECAY_THRESHOLD} employees since energy and
   * morale do not decay below that headcount.
   *
   * @param divisionName - The division to process.
   * @param cityName - The city to process.
   * @returns Observable that completes after actions are applied (or skipped).
   */
  private _processOffice$(divisionName: string, cityName: CityName): Observable<void> {
    return combineLatest({
      office: this.offices.infoFor$(divisionName, cityName),
      config: this.config.data$().pipe(first()),
    }).pipe(
      first(),
      map(({ office, config }) => {
        // Energy and morale only decay when the office reaches this headcount
        if (office.numEmployees < DECAY_THRESHOLD) return

        // --- Energy: buy tea for a flat +2 energy boost ---
        if (office.avgEnergy < office.maxEnergy) {
          this.ns.corporation.buyTea(divisionName, cityName)
        }

        // --- Morale: throw a party to recover morale toward its maximum ---
        if (office.avgMorale < office.maxMorale) {
          const target = Math.min(office.avgMorale + config.moraleStepSize, office.maxMorale)
          const cost = computeOptimalPartyCost(office.avgMorale, target)

          if (cost > 0) {
            this.ns.corporation.throwParty(divisionName, cityName, cost)
          }
        }
      }),
    )
  }
}
