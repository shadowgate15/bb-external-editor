import 'reflect-metadata'

import { CityName, CorpIndustryName, CorpMaterialName } from '@ns'
import { inject, injectable } from 'inversify'
import { combineLatest, filter, first, map, merge, Observable, switchMap, tap } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { Corporation } from './corporation'
import { delimited } from './delimited'
import { Divisions } from './divisions'
import { IndustryData } from './industry-data'
import { TotalRawProduction } from './total-raw-production'

/** Minimum export amount below which a route is skipped to avoid floating-point noise. */
const MIN_EXPORT_AMOUNT = 0.001

/**
 * Compute per-route export amounts for a single material given a set of producers and consumers.
 *
 * Product-making consumers are prioritized — they receive their full needed amount
 * before material-making consumers are allocated any supply. Each producer city
 * contributes proportionally to its share of total supply.
 *
 * @param producers - Producer city entries with their per-cycle production amount.
 * @param consumers - Consumer city entries with their needed amount and product-making flag.
 * @returns Array of non-zero export allocations.
 */
export function computeExportAllocations(
  producers: Array<{ key: string; supply: number }>,
  consumers: Array<{ key: string; needed: number; isProductMaker: boolean }>,
): Array<{ producerKey: string; consumerKey: string; amount: number }> {
  if (producers.length === 0 || consumers.length === 0) return []

  const totalSupply = producers.reduce((sum, p) => sum + p.supply, 0)
  if (totalSupply <= 0) return []

  // Priority-allocate total supply to consumers: product-makers first
  const sorted = [...consumers].sort((a, b) => Number(b.isProductMaker) - Number(a.isProductMaker))
  let remaining = totalSupply
  const consumerAllocations = new Map<string, number>()
  for (const consumer of sorted) {
    if (consumer.needed <= 0) {
      consumerAllocations.set(consumer.key, 0)
      continue
    }
    const allocated = Math.min(consumer.needed, remaining)
    consumerAllocations.set(consumer.key, allocated)
    remaining -= allocated
  }

  // For each (producer, consumer) pair: route amount = consumerAllocation × producer fraction
  const routes: Array<{ producerKey: string; consumerKey: string; amount: number }> = []
  for (const producer of producers) {
    if (producer.supply <= 0) continue
    const fraction = producer.supply / totalSupply
    for (const consumer of consumers) {
      const consumerAlloc = consumerAllocations.get(consumer.key) ?? 0
      const amount = consumerAlloc * fraction
      if (amount >= MIN_EXPORT_AMOUNT) {
        routes.push({ producerKey: producer.key, consumerKey: consumer.key, amount })
      }
    }
  }

  return routes
}

/**
 * Cancels all active export orders for a set of producer divisions, reading from the live
 * `material.exports` array for each produced material × city combination.
 *
 * Uses a snapshot of `material.exports` before iterating to avoid issues with concurrent
 * mutation of the array during cancellation.
 *
 * @param ns - The NS API instance.
 * @param divisions - All division snapshots.
 * @param industryData - Industry data keyed by industry name.
 */
function cancelAllProducerExports(
  ns: NS,
  divisions: ReturnType<NS['corporation']['getDivision']>[],
  industryData: Record<string, { producedMaterials?: CorpMaterialName[] }>,
): void {
  for (const div of divisions) {
    const producedMaterials = industryData[div.type]?.producedMaterials ?? []
    for (const city of div.cities) {
      for (const materialName of producedMaterials) {
        // Take a snapshot before iterating to avoid mutation during cancellation
        const exports = [...ns.corporation.getMaterial(div.name, city, materialName).exports]
        for (const exportOrder of exports) {
          ns.corporation.cancelExportMaterial(div.name, city, exportOrder.division, exportOrder.city, materialName)
        }
      }
    }
  }
}

/**
 * Reactive service that manages material exports between divisions each cycle.
 *
 * On each **EXPORT** state: computes how much of each produced material each consuming
 * division needs for the next production cycle and calls `exportMaterial` for each
 * non-zero allocation. Product-making divisions are prioritized over material-making ones
 * when supply is limited.
 *
 * On each **previous-EXPORT** state (when the EXPORT phase ends): cancels all active
 * export orders so the slate is clean for the next cycle.
 *
 * Export routes are inferred entirely from industry data — no configuration is required.
 * Only cross-division exports are managed (same-division city-to-city is excluded).
 */
@injectable('Singleton')
export class ExportManager {
  /**
   * Observable that sets up export routes on each EXPORT state transition.
   */
  readonly setupExports$: Observable<void> = this.corporation.nextState$().pipe(
    filter((state) => state === 'EXPORT'),
    tap(() => this.ns.print('INFO ExportManager: setting up inter-division exports...')),
    switchMap(() => this._applyExports$()),
  )

  /**
   * Observable that cancels all active export routes when the EXPORT phase ends.
   */
  readonly clearExports$: Observable<void> = this.corporation.previousState$().pipe(
    filter((state) => state === 'EXPORT'),
    tap(() => this.ns.print('INFO ExportManager: clearing inter-division exports...')),
    switchMap(() => this._cancelAllExports$()),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Corporation)
    private readonly corporation: Corporation,

    @inject(Divisions)
    private readonly divisions: Divisions,

    @inject(IndustryData)
    private readonly industryData: IndustryData,

    @inject(TotalRawProduction)
    private readonly totalRawProduction: TotalRawProduction,
  ) {}

  /** Subscribe to both export setup and clear observables. */
  start() {
    merge(this.setupExports$, this.clearExports$).subscribe()
  }

  /**
   * Compute and apply all cross-division export routes for the current cycle.
   *
   * Cancels any stale exports first (handles script restart), then computes
   * per-route amounts and calls `exportMaterial` for each non-zero allocation.
   *
   * @returns Observable that completes after all routes are applied.
   */
  private _applyExports$(): Observable<void> {
    return combineLatest({
      divisions: this.divisions.info$().pipe(first()),
      industryData: this.industryData.data$().pipe(first()),
      totalRawProdMap: this.totalRawProduction.totalRawProduction$.pipe(first()),
    }).pipe(
      first(),
      map(({ divisions, industryData, totalRawProdMap }) => {
        const allDivisions = Object.values(divisions)

        // Cancel any stale exports before setting up fresh ones (handles restart)
        cancelAllProducerExports(this.ns, allDivisions, industryData)

        // Collect all materials produced by any division
        const producedMaterialNames = new Set<CorpMaterialName>()
        for (const div of allDivisions) {
          for (const mat of industryData[div.type as CorpIndustryName]?.producedMaterials ?? []) {
            producedMaterialNames.add(mat)
          }
        }

        for (const materialName of producedMaterialNames) {
          const producerDivisionNames = new Set<string>()

          // Build producer list: divisions whose industry produces this material
          const producers: Array<{ key: string; divisionName: string; cityName: CityName; supply: number }> = []
          for (const div of allDivisions) {
            if (!(industryData[div.type as CorpIndustryName]?.producedMaterials ?? []).includes(materialName)) continue
            producerDivisionNames.add(div.name)
            for (const city of div.cities) {
              const supply = this.ns.corporation.getMaterial(div.name, city, materialName).productionAmount
              producers.push({ key: delimited(div.name, city), divisionName: div.name, cityName: city, supply })
            }
          }

          // Build consumer list: divisions that require this material, excluding producer divisions.
          // Same-division exports are excluded since each city independently manages its own production.
          const consumers: Array<{
            key: string
            divisionName: string
            cityName: CityName
            needed: number
            isProductMaker: boolean
          }> = []
          for (const div of allDivisions) {
            if (producerDivisionNames.has(div.name)) continue
            const coeff = industryData[div.type as CorpIndustryName]?.requiredMaterials?.[materialName]
            if (!coeff) continue
            for (const city of div.cities) {
              const totalRaw = totalRawProdMap[delimited(div.name, city)] ?? 0
              const stored = this.ns.corporation.getMaterial(div.name, city, materialName).stored
              const needed = Math.max(0, totalRaw * coeff - stored)
              consumers.push({
                key: delimited(div.name, city),
                divisionName: div.name,
                cityName: city,
                needed,
                isProductMaker: div.makesProducts,
              })
            }
          }

          if (consumers.length === 0) continue

          const allocations = computeExportAllocations(producers, consumers)

          const producerMap = new Map(producers.map((p) => [p.key, p]))
          const consumerMap = new Map(consumers.map((c) => [c.key, c]))

          for (const { producerKey, consumerKey, amount } of allocations) {
            const producer = producerMap.get(producerKey)!
            const consumer = consumerMap.get(consumerKey)!
            this.ns.corporation.exportMaterial(
              producer.divisionName,
              producer.cityName,
              consumer.divisionName,
              consumer.cityName,
              materialName,
              amount,
            )
          }
        }
      }),
    )
  }

  /**
   * Cancel all active export orders for all producer divisions.
   *
   * Iterates each produced material × city pair and cancels any active exports
   * using a snapshot of the exports array to prevent mutation-during-iteration issues.
   *
   * @returns Observable that completes after all cancellations are issued.
   */
  private _cancelAllExports$(): Observable<void> {
    return combineLatest({
      divisions: this.divisions.info$().pipe(first()),
      industryData: this.industryData.data$().pipe(first()),
    }).pipe(
      first(),
      map(({ divisions, industryData }) => {
        cancelAllProducerExports(this.ns, Object.values(divisions), industryData)
      }),
    )
  }
}
