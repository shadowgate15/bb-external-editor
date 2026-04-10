import 'reflect-metadata'

import { CityName, CorpIndustryData, Division, Material, Office, Product } from '@ns'
import { inject, injectable } from 'inversify'
import { combineLatest, filter, first, from, last, map, merge, mergeMap, Observable, switchMap, tap } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { Corporation } from './corporation'
import { delimited } from './delimited'
import { Divisions } from './divisions'
import { IndustryData } from './industry-data'
import { MaterialData } from './material-data'
import { Offices } from './offices'

/** Price used to force the penalty-range markup multiplier for product MarkupLimit calibration. */
const CALIBRATION_PRICE = 1e15

/**
 * Represents a sell configuration emitted by {@link Seller.optimalSellingPrice$}.
 *
 * Contains the division, city, quantity to list for sale, and the computed optimal price,
 * plus a discriminated union identifying whether the item is a material or a product.
 */
export type SellRecord = {
  divisionName: string
  cityName: CityName
  quantity: number
  price: number
} & ({ materialName: string } | { productName: string })

/**
 * Compute the potential sales volume for an item — the maximum number of units that could
 * be sold per cycle before markup multiplier adjustments.
 *
 * @param itemMultiplier - Quality-based multiplier: `quality + 0.001` for materials,
 *   `0.5 * max(effectiveRating, 0)^0.65` for products.
 * @param division - The division owning the item, providing awareness/popularity.
 * @param office - The office in the item's city, providing Business employee production.
 * @param industryData - Industry constants for the division type (advertising factor).
 * @param salesBotsLevel - Current upgrade level of "ABC SalesBots".
 * @param demand - Item demand (0–100). Defaults to 100 if the unlock is not purchased.
 * @param competition - Item competition (0–100). Defaults to 0 if the unlock is not purchased.
 * @returns The computed potential sales volume.
 */
export function computePotentialSalesVolume(
  itemMultiplier: number,
  division: Division,
  office: Office,
  industryData: CorpIndustryData,
  salesBotsLevel: number,
  demand: number | undefined,
  competition: number | undefined,
): number {
  const businessProduction = 1 + (office.employeeProductionByJob['Business'] ?? 0)
  const businessFactor = Math.pow(businessProduction, 0.26) + businessProduction * 0.0001

  const f = industryData.advertisingFactor ?? 0
  const awarenessFactor = Math.pow(division.awareness + 1, f)
  const popularityFactor = Math.pow(division.popularity + 1, f)
  const ratioFactor =
    division.awareness !== 0 ? Math.max(0.01, (division.popularity + 0.001) / division.awareness) : 0.01
  const advertFactor = Math.pow(awarenessFactor * popularityFactor * ratioFactor, 0.85)

  const effectiveDemand = demand ?? 100
  const effectiveCompetition = competition ?? 0
  const marketFactor = Math.max(0.1, effectiveDemand * (100 - effectiveCompetition) * 0.01)

  const salesBotsFactor = 1 + salesBotsLevel * 0.01

  return itemMultiplier * businessFactor * advertFactor * marketFactor * salesBotsFactor
}

/**
 * Compute the Market-TA2 optimal sell price for an item.
 *
 * When potential sales volume exceeds expected, we can afford a markup penalty and raise
 * the price above `marketPrice + markupLimit`. Otherwise, clamp at the safe maximum.
 *
 * @param stored - Units currently in warehouse (used to derive `expectedSalesVolume = stored / 10`).
 * @param marketPrice - The item's market reference price (material: `marketPrice`, product: `productionCost`).
 * @param markupLimit - How far above market price we can price before sales are penalised.
 * @param potentialSalesVolume - The computed potential sales volume for this item.
 * @returns The optimal sell price.
 */
export function computeOptimalPrice(
  stored: number,
  marketPrice: number,
  markupLimit: number,
  potentialSalesVolume: number,
): number {
  // Use at least 1 unit to avoid divide-by-zero when warehouse is empty
  const effectiveStored = Math.max(stored, 1)
  const expectedSalesVolume = effectiveStored / 10

  if (potentialSalesVolume > expectedSalesVolume) {
    // Can accept penalty — raise price beyond marketPrice + markupLimit
    return marketPrice + (markupLimit * Math.sqrt(potentialSalesVolume)) / Math.sqrt(expectedSalesVolume)
  }

  // Can't sell fast enough — clamp to safe zone (no penalty)
  return marketPrice + markupLimit
}

/**
 * Reactive service that computes Market-TA2 optimal selling prices for all materials
 * and products across every division × city pair, emitting during the `SALE` corp state.
 *
 * For materials, `MarkupLimit = material.quality / materialData.baseMarkup`.
 * For products, `MarkupLimit` is derived empirically via a calibration phase:
 *   - On the first `SALE` with no cached `MarkupLimit`, a sentinel calibration price
 *     (`CALIBRATION_PRICE`) is emitted, forcing the game into the penalty range.
 *   - On subsequent cycles, `MarkupLimit` is back-calculated from the observed
 *     `actualSellAmount` and the previously emitted `desiredSellPrice`, then cached.
 */
@injectable('Singleton')
export class Seller {
  /** Cached per-product markup limits, keyed by `"{divisionName}|{productName}"`. */
  private readonly _productMarkupLimits = new Map<string, number>()

  /**
   * Observable that emits one {@link SellRecord} per material/product per division × city
   * on each `SALE` corporation state transition.
   */
  readonly optimalSellingPrice$: Observable<SellRecord> = this.corporation.nextState$().pipe(
    // only act during the SALE state
    filter((state) => state === 'SALE'),
    tap(() => this.ns.print('INFO Detected SALE state, computing optimal selling prices...')),
    switchMap(() =>
      this.divisions
        .eachDivisionNameAndCityName$()
        .pipe(
          mergeMap(({ divisionName, cityName }) =>
            merge(
              this._materialSellRecords$(divisionName, cityName),
              this._productSellRecords$(divisionName, cityName),
            ),
          ),
        ),
    ),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Corporation)
    private readonly corporation: Corporation,

    @inject(Divisions)
    private readonly divisions: Divisions,

    @inject(Offices)
    private readonly offices: Offices,

    @inject(IndustryData)
    private readonly industryData: IndustryData,

    @inject(MaterialData)
    private readonly materialData: MaterialData,
  ) {}

  start() {
    this.optimalSellingPrice$.subscribe(({ divisionName, cityName, quantity, price, ...rest }) => {
      if ('materialName' in rest) {
        this.ns.corporation.sellMaterial(
          divisionName,
          cityName,
          rest.materialName,
          quantity.toString(),
          price.toString(),
        )
      } else {
        this.ns.corporation.sellProduct(
          divisionName,
          cityName,
          rest.productName,
          quantity.toString(),
          price.toString(),
          false,
        )
      }
    })
  }

  /**
   * Emits one {@link SellRecord} per material in the given division × city.
   *
   * @param divisionName - The division to process.
   * @param cityName - The city to process.
   * @returns Observable of sell records for each material.
   */
  private _materialSellRecords$(divisionName: string, cityName: CityName): Observable<SellRecord> {
    return combineLatest({
      division: this.divisions.divisionFor$(divisionName),
      office: this.offices.infoFor$(divisionName, cityName),
      materials: this.divisions.divisionCityMaterialsFor$(divisionName, cityName),
      industryData: this.industryData.data$().pipe(first()),
      materialData: this.materialData.data$().pipe(first()),
      upgradeLevels: this.corporation.upgradeLevels$().pipe(first()),
    }).pipe(
      last(),
      mergeMap(({ division, office, materials, industryData, materialData, upgradeLevels }) =>
        from(materials).pipe(
          filter((material) => material.stored > 0),
          // Only sell materials that the industry produces
          filter((material) => (industryData[division.type].producedMaterials ?? []).includes(material.name)),
          mergeMap((material) => {
            const record = this._computeMaterialRecord(
              divisionName,
              cityName,
              material,
              division,
              office,
              industryData[division.type],
              materialData[material.name].baseMarkup,
              upgradeLevels['ABC SalesBots'] ?? 0,
            )

            return record ? [record] : []
          }),
        ),
      ),
    )
  }

  /**
   * Emits one {@link SellRecord} per product in the given division × city.
   *
   * Products without a cached `MarkupLimit` are first sent at {@link CALIBRATION_PRICE} to
   * force the game into the penalty range, enabling back-calculation of `MarkupLimit` next
   * cycle.
   *
   * @param divisionName - The division to process.
   * @param cityName - The city to process.
   * @returns Observable of sell records for each product.
   */
  private _productSellRecords$(divisionName: string, cityName: CityName): Observable<SellRecord> {
    return combineLatest({
      division: this.divisions.divisionFor$(divisionName),
      office: this.offices.infoFor$(divisionName, cityName),
      products: this.divisions.divisionCityProductsFor$(divisionName, cityName),
      industryData: this.industryData.data$().pipe(first()),
      upgradeLevels: this.corporation.upgradeLevels$().pipe(first()),
    }).pipe(
      last(),
      mergeMap(({ division, office, products, industryData, upgradeLevels }) =>
        from(products).pipe(
          filter((product) => product.stored > 0),
          filter((product) => product.productionAmount > 0),
          map((product) =>
            this._computeProductRecord(
              divisionName,
              cityName,
              product,
              division,
              office,
              industryData[division.type],
              upgradeLevels['ABC SalesBots'] ?? 0,
            ),
          ),
        ),
      ),
    )
  }

  /**
   * Compute the optimal sell record for a single material.
   *
   * Returns `null` when the material has no market price (should not occur in normal play).
   *
   * @param divisionName - Name of the owning division.
   * @param cityName - City of the warehouse.
   * @param material - The material snapshot.
   * @param division - The division snapshot (awareness, popularity, type).
   * @param office - The office snapshot (employee production).
   * @param industryData - Industry constants for the division type.
   * @param baseMarkup - The material's base markup constant from `getMaterialData`.
   * @param salesBotsLevel - Current "ABC SalesBots" upgrade level.
   * @returns A {@link SellRecord} with `materialName`, or `null` if data is missing.
   */
  private _computeMaterialRecord(
    divisionName: string,
    cityName: CityName,
    material: Material,
    division: Division,
    office: Office,
    industryData: CorpIndustryData,
    baseMarkup: number,
    salesBotsLevel: number,
  ): SellRecord | null {
    if (!material.marketPrice) return null

    const itemMultiplier = material.quality + 0.001
    const markupLimit = material.quality / baseMarkup
    const potentialSalesVolume = computePotentialSalesVolume(
      itemMultiplier,
      division,
      office,
      industryData,
      salesBotsLevel,
      material.demand,
      material.competition,
    )
    const price = computeOptimalPrice(material.stored, material.marketPrice, markupLimit, potentialSalesVolume)

    return { divisionName, cityName, materialName: material.name, quantity: material.stored, price }
  }

  /**
   * Compute the optimal sell record for a single product, handling MarkupLimit calibration.
   *
   * If no MarkupLimit is cached for this product, a calibration price is returned and
   * `MarkupLimit` is derived from `actualSellAmount` + `desiredSellPrice` if possible.
   *
   * @param divisionName - Name of the owning division.
   * @param cityName - City of the warehouse.
   * @param product - The product snapshot.
   * @param division - The division snapshot.
   * @param office - The office snapshot.
   * @param industryData - Industry constants for the division type.
   * @param salesBotsLevel - Current "ABC SalesBots" upgrade level.
   * @returns A {@link SellRecord} with `productName`.
   */
  private _computeProductRecord(
    divisionName: string,
    cityName: CityName,
    product: Product,
    division: Division,
    office: Office,
    industryData: CorpIndustryData,
    salesBotsLevel: number,
  ): SellRecord {
    const key = delimited(divisionName, product.name)
    const marketPrice = product.productionCost

    const itemMultiplier = 0.5 * Math.pow(Math.max(product.effectiveRating, 0), 0.65)
    const potentialSalesVolume = computePotentialSalesVolume(
      itemMultiplier,
      division,
      office,
      industryData,
      salesBotsLevel,
      product.demand,
      product.competition,
    )

    // Attempt to derive MarkupLimit from previous cycle data if not yet cached
    if (!this._productMarkupLimits.has(key)) {
      const prevPrice = product.desiredSellPrice
      const prevActual = product.actualSellAmount

      if (typeof prevPrice === 'number' && prevPrice > marketPrice && prevActual > 0 && potentialSalesVolume > 0) {
        // Reverse-engineer MarkupLimit from observed penalty range data:
        // MarkupLimit = (SellingPrice - MarketPrice) * sqrt(ActualSalesVolume / PotentialSalesVolume)
        const markupLimit = (prevPrice - marketPrice) * Math.sqrt(prevActual / potentialSalesVolume)
        this._productMarkupLimits.set(key, markupLimit)
        this.ns.print(`INFO Calibrated MarkupLimit for ${product.name} in ${divisionName}: ${markupLimit.toFixed(2)}`)
      }
    }

    const markupLimit = this._productMarkupLimits.get(key)

    if (markupLimit === undefined) {
      // No MarkupLimit yet — emit calibration price to force penalty range next cycle
      this.ns.print(`INFO Calibrating MarkupLimit for ${product.name} in ${divisionName} — setting high price`)
      return { divisionName, cityName, productName: product.name, quantity: product.stored, price: CALIBRATION_PRICE }
    }

    const price = computeOptimalPrice(product.stored, marketPrice, markupLimit, potentialSalesVolume)

    return { divisionName, cityName, productName: product.name, quantity: product.stored, price }
  }
}
