import 'reflect-metadata'

import { CityName, CorpIndustryName, CorpMaterialName } from '@ns'
import { inject, injectable } from 'inversify'
import { combineLatest, EMPTY, filter, first, map, mergeMap, Observable, switchMap, tap } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { Config } from './config'
import { Corporation } from './corporation'
import { Divisions } from './divisions'
import { IndustryData } from './industry-data'
import { MaterialData } from './material-data'
import { Warehouses } from './warehouses'

/** The four boost materials and their corresponding `CorpIndustryData` factor field names. */
export const BOOST_MATERIAL_FACTORS: Readonly<Record<string, CorpMaterialName>> = {
  realEstateFactor: 'Real Estate',
  hardwareFactor: 'Hardware',
  robotFactor: 'Robots',
  aiCoreFactor: 'AI Cores',
} as const

/**
 * Scaling coefficient applied to stored boost material quantities in the game's production
 * multiplier formula: `(BOOST_MATERIAL_SCALING * qty + 1) ^ factor`.
 *
 * Source: `Division.calculateProductionFactors()` in the Bitburner source.
 */
export const BOOST_MATERIAL_SCALING = 0.002

/**
 * Outer exponent applied to each city's boost multiplier when accumulating across all cities.
 *
 * Source: `Division.calculateProductionFactors()` in the Bitburner source.
 */
export const BOOST_MATERIAL_OUTER_EXPONENT = 0.73

/**
 * Compute the optimal total warehouse storage to allocate to boost materials for a given
 * warehouse size and industry.
 *
 * Derived from the Bitburner production-multiplier formula:
 * ```
 * cityMult = Π_i (BOOST_MATERIAL_SCALING · qty_i + 1)^c_i
 * productionMult = Σ_cities cityMult^BOOST_MATERIAL_OUTER_EXPONENT
 * ```
 *
 * With Cobb-Douglas optimal distribution (see {@link computeBoostMaterialQuantities}),
 * `productionMult` scales as `(B + Sₜ/BOOST_MATERIAL_SCALING)^(OUTER · C)` where `B` is the
 * total boost storage budget, `C = Σ c_i`, and `Sₜ = Σ sᵢ`.
 *
 * The closed-form budget that maximises the log-balance between production-multiplier growth
 * and remaining free space is:
 * ```
 * B* = (OUTER · C · W − Sₜ / BOOST_MATERIAL_SCALING) / (1 + OUTER · C)
 * ```
 * clamped to `[0, warehouseSize]`.
 *
 * For large warehouses this converges to the asymptotic fraction `OUTER·C / (1 + OUTER·C)`
 * (e.g. ~52.6% for Agriculture where C ≈ 1.52).
 *
 * @param warehouseSize - Total warehouse capacity `W`.
 * @param factors - Map of material name → boost coefficient `c_i` (only entries with `c_i > 0` are used).
 * @param sizes - Map of material name → storage size per unit `sᵢ`.
 * @returns Optimal storage budget in warehouse units (always `≥ 0`).
 */
export function computeOptimalBoostStorageBudget(
  warehouseSize: number,
  factors: Partial<Record<CorpMaterialName, number>>,
  sizes: Partial<Record<CorpMaterialName, number>>,
): number {
  const names = (Object.keys(factors) as CorpMaterialName[]).filter((n) => (factors[n] ?? 0) > 0)
  if (names.length === 0) return 0

  const C = names.reduce((sum, n) => sum + (factors[n] ?? 0), 0)
  const S_total = names.reduce((sum, n) => sum + (sizes[n] ?? 0), 0)

  const outerC = BOOST_MATERIAL_OUTER_EXPONENT * C
  const budget = (outerC * warehouseSize - S_total / BOOST_MATERIAL_SCALING) / (1 + outerC)
  return Math.max(0, budget)
}

/**
 * Compute the optimal boost material quantities for a given storage budget using the
 * Lagrange multiplier closed-form solution.
 *
 * Each material `i` has:
 * - `c_i` (factor/coefficient) from `CorpIndustryData`
 * - `s_i` (storage size per unit) from `CorpMaterialConstantData`
 *
 * The optimal storage amount for material `i` is:
 * ```
 * x_i * s_i = (S - 500 * (s_i/c_i * (C - c_i) - (S_total - s_i))) / (C / c_i)
 * ```
 * where `C = Σ c_i` and `S_total = Σ s_i`.
 *
 * If any quantity is negative, that material is removed and the system is re-solved
 * recursively with the remaining materials (per the "Handle low storage space" approach).
 *
 * @param storageSpace - Total storage budget `S` to fill with boost materials.
 * @param factors - Map of material name → boost coefficient `c_i` (must be `> 0`).
 * @param sizes - Map of material name → storage size per unit `s_i`.
 * @returns Map of material name → optimal quantity to store. Excluded materials are absent.
 */
export function computeBoostMaterialQuantities(
  storageSpace: number,
  factors: Partial<Record<CorpMaterialName, number>>,
  sizes: Partial<Record<CorpMaterialName, number>>,
): Partial<Record<CorpMaterialName, number>> {
  const names = (Object.keys(factors) as CorpMaterialName[]).filter((n) => (factors[n] ?? 0) > 0)
  return _computeRecursive(storageSpace, names, factors, sizes)
}

function _computeRecursive(
  S: number,
  names: CorpMaterialName[],
  factors: Partial<Record<CorpMaterialName, number>>,
  sizes: Partial<Record<CorpMaterialName, number>>,
): Partial<Record<CorpMaterialName, number>> {
  if (names.length === 0) return {}

  const C = names.reduce((sum, n) => sum + (factors[n] ?? 0), 0)
  const S_total = names.reduce((sum, n) => sum + (sizes[n] ?? 0), 0)

  const result: Partial<Record<CorpMaterialName, number>> = {}
  const negative: CorpMaterialName[] = []

  for (const name of names) {
    const c_i = factors[name] ?? 0
    const s_i = sizes[name] ?? 0
    // Lagrange closed-form: x_i * s_i = numerator / (C / c_i)
    const xs = (S - 500 * ((s_i / c_i) * (C - c_i) - (S_total - s_i))) / (C / c_i)
    const x = xs / s_i

    if (x < 0) {
      negative.push(name)
    } else {
      result[name] = x
    }
  }

  if (negative.length > 0) {
    // Re-solve without the negative materials
    const remaining = names.filter((n) => !negative.includes(n))
    return _computeRecursive(S, remaining, factors, sizes)
  }

  return result
}

/**
 * Reactive service that purchases boost materials each cycle to fill the optimal fraction of each warehouse.
 *
 * Enabled only when `config.enableBoostMaterials` is `true`. When enabled, fires on each
 * **SALE** phase (when `nextState` is `PURCHASE`) and for every active division × city:
 * 1. Computes the optimal total boost storage budget via {@link computeOptimalBoostStorageBudget}.
 * 2. Distributes that budget across materials via {@link computeBoostMaterialQuantities}.
 * 3. Buys only the deficit (target − stored), skipping materials already at or above target.
 */
@injectable('Singleton')
export class BoostMaterial {
  /**
   * Inner observable that fires once per SALE state, emitting one buy action per division × city.
   * Active only while `config.enableBoostMaterials` is `true`.
   */
  private readonly _innerFill$: Observable<void> = this.corporation.nextState$().pipe(
    // only act when PURCHASE is the upcoming state (we are currently in SALE)
    filter((state) => state === 'PURCHASE'),
    tap(() => this.ns.print('INFO Boost Material: computing boost material purchases...')),
    switchMap(() => this.divisions.eachDivisionNameAndCityName$()),
    mergeMap(({ divisionName, cityName }) => this._processCity$(divisionName, cityName)),
  )

  /**
   * Observable that runs the boost material fill loop while `config.enableBoostMaterials` is `true`.
   * Automatically starts and stops as the config flag changes.
   */
  readonly fillBoostMaterials$: Observable<void> = this.config.data$().pipe(
    // toggle inner loop based on config flag
    switchMap((c) => (c.enableBoostMaterials ? this._innerFill$ : EMPTY)),
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

    @inject(Warehouses)
    private readonly warehouses: Warehouses,

    @inject(IndustryData)
    private readonly industryData: IndustryData,

    @inject(MaterialData)
    private readonly materialData: MaterialData,
  ) {}

  /** Subscribe to {@link fillBoostMaterials$} to start the boost material fill loop. */
  start() {
    this.fillBoostMaterials$.subscribe()
  }

  /**
   * Process one division × city: compute optimal boost material targets and buy any deficit.
   *
   * @param divisionName - The division to process.
   * @param cityName - The city to process.
   * @returns Observable that completes after purchases are issued.
   */
  private _processCity$(divisionName: string, cityName: CityName): Observable<void> {
    return combineLatest({
      division: this.divisions.divisionFor$(divisionName),
      warehouse: this.warehouses.warehouseFor$(divisionName, cityName),
      industryData: this.industryData.data$().pipe(first()),
      materialData: this.materialData.data$().pipe(first()),
    }).pipe(
      first(),
      map(({ division, warehouse, industryData, materialData }) => {
        const industry = industryData[division.type as CorpIndustryName]

        // Build factor and size maps for materials this industry supports
        const factors: Partial<Record<CorpMaterialName, number>> = {}
        const sizes: Partial<Record<CorpMaterialName, number>> = {}

        for (const [fieldName, materialName] of Object.entries(BOOST_MATERIAL_FACTORS)) {
          const factor = industry[fieldName as keyof typeof industry] as number | undefined
          if (factor !== undefined && factor > 0) {
            factors[materialName] = factor
            sizes[materialName] = materialData[materialName]?.size ?? 0
          }
        }

        const storageTarget = computeOptimalBoostStorageBudget(warehouse.size, factors, sizes)
        const targets = computeBoostMaterialQuantities(storageTarget, factors, sizes)

        for (const [name, targetQty] of Object.entries(targets) as [CorpMaterialName, number][]) {
          const stored = this.ns.corporation.getMaterial(divisionName, cityName, name).stored
          const deficit = Math.max(0, (Math.floor(targetQty) - stored) / 10)

          // this.ns.print(`INFO Boost Material: buying ${deficit} ${name} for ${divisionName}/${cityName}`)
          this.ns.corporation.buyMaterial(divisionName, cityName, name, deficit)
        }
      }),
    )
  }
}
