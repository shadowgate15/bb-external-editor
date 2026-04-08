import 'reflect-metadata'

import { CityName, CorpIndustryName, CorpMaterialName } from '@ns'
import { inject, injectable } from 'inversify'
import { combineLatest, filter, first, map, mergeMap, Observable, switchMap, tap } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { Corporation } from './corporation'
import { delimited } from './delimited'
import { Divisions } from './divisions'
import { IndustryData } from './industry-data'
import { MaterialData } from './material-data'
import { TotalRawProduction } from './total-raw-production'
import { Warehouses } from './warehouses'

/** Number of consecutive zero-production cycles before a warehouse is considered congested. */
const CONGESTION_THRESHOLD = 5

/**
 * Compute the per-material input purchase quantities required to sustain production.
 *
 * Aligns all inputs to the bottleneck material (the one that limits total output the most),
 * then scales the entire set down proportionally if the total required space exceeds the
 * warehouse's free space. Finally, deducts already-stored amounts so only the deficit is bought.
 *
 * @param totalRawProduction - The total limited raw production for this division × city.
 * @param requiredMaterials - Map of input material name → required coefficient per unit of raw production.
 * @param storedAmounts - Map of input material name → currently stored units in the warehouse.
 * @param materialSizes - Map of material name → warehouse storage size per unit.
 * @param freeSpace - Available warehouse free space.
 * @returns Map of material name → quantity to buy this cycle (zero or positive).
 */
export function computeInputRequirements(
  totalRawProduction: number,
  requiredMaterials: Partial<Record<CorpMaterialName, number>>,
  storedAmounts: Partial<Record<string, number>>,
  materialSizes: Partial<Record<string, number>>,
  freeSpace: number,
): Record<string, number> {
  const entries = Object.entries(requiredMaterials) as [CorpMaterialName, number][]
  if (entries.length === 0) return {}

  // Compute raw required quantity for each input material
  const rawRequired: Record<string, number> = {}
  for (const [name, coeff] of entries) {
    rawRequired[name] = totalRawProduction * coeff
  }

  // Find the minimum output units supported across all inputs (alignment step)
  // Each input supports rawRequired[name] / coeff = totalRawProduction output units.
  // Since they're all derived from the same totalRawProduction, they're already aligned.
  // We still respect this calculation explicitly for correctness.
  const minOutputUnits = Math.min(...entries.map(([name, coeff]) => (coeff > 0 ? rawRequired[name] / coeff : Infinity)))

  // Align all inputs to the minimum output units
  const aligned: Record<string, number> = {}
  for (const [name, coeff] of entries) {
    aligned[name] = minOutputUnits * coeff
  }

  // Calculate total storage space required by all aligned input quantities
  let totalInputSize = 0
  for (const [name] of entries) {
    totalInputSize += aligned[name] * (materialSizes[name] ?? 0)
  }

  // Scale down proportionally if inputs don't fit in available space
  const spaceMult = totalInputSize > 0 && totalInputSize > freeSpace ? freeSpace / totalInputSize : 1

  // Deduct stored amounts and return only the deficit
  const result: Record<string, number> = {}
  for (const [name] of entries) {
    const needed = aligned[name] * spaceMult
    const stored = storedAmounts[name] ?? 0
    result[name] = Math.max(0, needed - stored)
  }

  return result
}

/**
 * Reactive service that purchases input materials each cycle to sustain production.
 *
 * On each **SALE** phase (when `nextState` is `PURCHASE`):
 * 1. Checks each division × city for warehouse congestion (≥ {@link CONGESTION_THRESHOLD}
 *    consecutive cycles with zero production output).
 * 2. When congested, discards all input materials by selling them at price `'0'`.
 * 3. Otherwise, uses {@link TotalRawProduction.totalRawProduction$} to compute how much
 *    of each input material to buy and calls `ns.corporation.buyMaterial`.
 */
@injectable('Singleton')
export class SmartSupply {
  /**
   * Per-division × city count of consecutive cycles with zero production output.
   * Keyed by `"divisionName|cityName"`.
   */
  private readonly _congestionData = new Map<string, number>()

  /**
   * Observable that fires once per SALE state, emitting one action per division × city.
   *
   * Each emission is either a congestion-mitigation action (discard all inputs) or a
   * buy action specifying the required quantity of each input material.
   */
  readonly purchaseMaterials$: Observable<void> = this.corporation.nextState$().pipe(
    // only act when PURCHASE is the upcoming state (we are currently in SALE)
    filter((state) => state === 'PURCHASE'),
    tap(() => this.ns.print('INFO Smart Supply: computing input purchases...')),
    switchMap(() => this.divisions.eachDivisionNameAndCityName$()),
    mergeMap(({ divisionName, cityName }) => this._processCity$(divisionName, cityName)),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Corporation)
    private readonly corporation: Corporation,

    @inject(Divisions)
    private readonly divisions: Divisions,

    @inject(Warehouses)
    private readonly warehouses: Warehouses,

    @inject(IndustryData)
    private readonly industryData: IndustryData,

    @inject(MaterialData)
    private readonly materialData: MaterialData,

    @inject(TotalRawProduction)
    private readonly totalRawProduction: TotalRawProduction,
  ) {}

  /** Subscribe to {@link purchaseMaterials$} to start the smart supply loop. */
  start() {
    this.purchaseMaterials$.subscribe()
  }

  /**
   * Process one division × city: detect congestion and either mitigate or buy inputs.
   *
   * @param divisionName - The division to process.
   * @param cityName - The city to process.
   * @returns Observable that completes after the action is taken.
   */
  private _processCity$(divisionName: string, cityName: CityName): Observable<void> {
    const key = delimited(divisionName, cityName)

    return combineLatest({
      division: this.divisions.divisionFor$(divisionName),
      warehouse: this.warehouses.warehouseFor$(divisionName, cityName),
      industryData: this.industryData.data$().pipe(first()),
      materialData: this.materialData.data$().pipe(first()),
      totalRawProdMap: this.totalRawProduction.totalRawProduction$.pipe(first()),
    }).pipe(
      first(),
      map(({ division, warehouse, industryData, materialData, totalRawProdMap }) => {
        const industry = industryData[division.type as CorpIndustryName]
        const inputEntries = Object.entries(industry.requiredMaterials) as [CorpMaterialName, number][]
        const totalRaw = totalRawProdMap[key] ?? 0
        const freeSpace = warehouse.size - warehouse.sizeUsed

        // --- Congestion detection ---
        const prevCongestionCount = this._congestionData.get(key) ?? 0
        const isCongested = this._checkCongestion(divisionName, cityName, division, industryData, key)
        const wasCongested = prevCongestionCount > CONGESTION_THRESHOLD

        if (isCongested) {
          this.ns.print(`WARN Smart Supply: warehouse congested at ${divisionName}/${cityName} — discarding inputs`)
          // Discard all input materials by selling them for free
          for (const [name] of inputEntries) {
            this.ns.corporation.sellMaterial(divisionName, cityName, name, 'MAX', '0')
          }
          return
        }

        // Reset sell orders if we just exited congestion so inputs are no longer discarded
        if (wasCongested) {
          this.ns.print(`INFO Smart Supply: congestion cleared at ${divisionName}/${cityName} — resetting sell orders`)
          for (const [name] of inputEntries) {
            this.ns.corporation.sellMaterial(divisionName, cityName, name, '0', 'MP')
          }
        }

        // --- Normal purchasing ---
        if (totalRaw <= 0 || inputEntries.length === 0) return

        const storedAmounts: Partial<Record<string, number>> = {}
        for (const [name] of inputEntries) {
          storedAmounts[name] = this.ns.corporation.getMaterial(divisionName, cityName, name).stored
        }

        const materialSizes: Partial<Record<string, number>> = {}
        for (const [name] of inputEntries) {
          materialSizes[name] = materialData[name as CorpMaterialName]?.size ?? 0
        }

        const quantities = computeInputRequirements(
          totalRaw,
          industry.requiredMaterials,
          storedAmounts,
          materialSizes,
          freeSpace,
        )

        for (const [name, qty] of Object.entries(quantities)) {
          this.ns.corporation.buyMaterial(divisionName, cityName, name, qty)
        }
      }),
    )
  }

  /**
   * Check and update the congestion counter for a given division × city.
   *
   * Examines `productionAmount` of all output materials and finished products.
   * Increments the counter when all outputs show zero production; resets it otherwise.
   * Returns `true` when the counter exceeds {@link CONGESTION_THRESHOLD}.
   *
   * @param divisionName - The division to check.
   * @param cityName - The city to check.
   * @param division - The current division snapshot.
   * @param industryData - Industry data record.
   * @param key - The delimited `divisionName|cityName` key.
   * @returns `true` if the warehouse is considered congested.
   */
  private _checkCongestion(
    divisionName: string,
    cityName: CityName,
    division: ReturnType<NS['corporation']['getDivision']>,
    industryData: Record<string, { producedMaterials?: CorpMaterialName[]; makesProducts?: boolean }>,
    key: string,
  ): boolean {
    const industry = industryData[division.type]
    const outputNames = industry?.producedMaterials ?? []

    // Check if any output shows non-zero production
    const hasProduction =
      outputNames.some((name) => this.ns.corporation.getMaterial(divisionName, cityName, name).productionAmount > 0) ||
      (division.makesProducts &&
        division.products.some(
          (name) => this.ns.corporation.getProduct(divisionName, cityName, name).productionAmount > 0,
        ))

    const prev = this._congestionData.get(key) ?? 0
    const next = hasProduction ? 0 : prev + 1
    this._congestionData.set(key, next)

    return next > CONGESTION_THRESHOLD
  }
}
