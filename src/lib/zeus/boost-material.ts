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
const BOOST_MATERIAL_FACTORS: Readonly<Record<string, CorpMaterialName>> = {
  realEstateFactor: 'Real Estate',
  hardwareFactor: 'Hardware',
  robotFactor: 'Robots',
  aiCoreFactor: 'AI Cores',
} as const

/** Fraction of warehouse capacity to target when filling boost materials. */
const BOOST_FILL_RATIO = 0.5

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
 * Reactive service that purchases boost materials each cycle to fill 50% of each warehouse.
 *
 * Enabled only when `config.enableBoostMaterials` is `true`. When enabled, fires on each
 * **SALE** phase (when `nextState` is `PURCHASE`) and for every active division × city:
 * 1. Computes the optimal boost material quantities for {@link BOOST_FILL_RATIO} of warehouse capacity.
 * 2. Buys only the deficit (target − stored), skipping materials already at or above target.
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
        const storageTarget = warehouse.size * BOOST_FILL_RATIO

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

        const targets = computeBoostMaterialQuantities(storageTarget, factors, sizes)

        for (const [name, targetQty] of Object.entries(targets) as [CorpMaterialName, number][]) {
          const stored = this.ns.corporation.getMaterial(divisionName, cityName, name).stored
          const deficit = Math.max(0, Math.floor(targetQty) - stored)
          if (deficit > 0) {
            this.ns.print(`INFO Boost Material: buying ${deficit} ${name} for ${divisionName}/${cityName}`)
            this.ns.corporation.buyMaterial(divisionName, cityName, name, deficit)
          }
        }
      }),
    )
  }
}
