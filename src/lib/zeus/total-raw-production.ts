import 'reflect-metadata'

import { CityName, CorpIndustryName, CorpMaterialName, CorpResearchName, Division, Office, Product } from '@ns'
import { inject, injectable } from 'inversify'
import { combineLatest, filter, first, map, mergeMap, Observable, scan, shareReplay, switchMap } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { Corporation } from './corporation'
import { delimited } from './delimited'
import { Divisions } from './divisions'
import { IndustryData } from './industry-data'
import { MaterialData } from './material-data'
import { Offices } from './offices'
import { Warehouses } from './warehouses'

/** Production multiplier added per level of the "Smart Factories" corporation upgrade. */
const SMART_FACTORIES_MULT_PER_LEVEL = 0.03

/**
 * Production multipliers granted by specific researches.
 * These are multiplied together for all unlocked entries.
 */
const RESEARCH_PRODUCTION_MULTIPLIERS: Partial<Record<CorpResearchName, number>> = {
  'Self-Correcting Assemblers': 1.1,
  'Drones - Assembly': 1.2,
}

/**
 * Compute the division's base raw production for one output type in one city.
 *
 * Implements the formula from the division-raw-production game documentation.
 *
 * @param office - Office snapshot for this city (provides employee production by job).
 * @param division - Division snapshot (provides the boost-material production multiplier).
 * @param smartFactoriesLevel - Current level of the "Smart Factories" corporation upgrade.
 * @param researchProductionMult - Combined production multiplier from unlocked researches.
 * @param isProduct - `true` when computing for a product output; `false` for material output.
 * @returns The base raw production value.
 */
export function computeRawProduction(
  office: Office,
  division: Division,
  smartFactoriesLevel: number,
  researchProductionMult: number,
  isProduct: boolean,
): number {
  const operationsProd = office.employeeProductionByJob['Operations'] ?? 0
  const engineerProd = office.employeeProductionByJob['Engineer'] ?? 0
  const managementProd = office.employeeProductionByJob['Management'] ?? 0
  const totalProd = operationsProd + engineerProd + managementProd

  // Avoid divide-by-zero when no employees are assigned to productive roles
  const managementFactor = totalProd > 0 ? 1 + managementProd / (1.2 * totalProd) : 1
  const employeeProdMultiplier = (Math.pow(operationsProd, 0.4) + Math.pow(engineerProd, 0.3)) * managementFactor

  const balancingMultiplier = isProduct ? 0.5 * 0.05 : 0.05
  const officeMultiplier = balancingMultiplier * employeeProdMultiplier

  const upgradeMultiplier = 1 + SMART_FACTORIES_MULT_PER_LEVEL * smartFactoriesLevel

  return officeMultiplier * division.productionMult * upgradeMultiplier * researchProductionMult
}

/**
 * Compute the net warehouse storage change per unit of raw production.
 *
 * A positive value means the warehouse fills up as production runs; negative means
 * inputs consume more space than outputs produce.
 *
 * @param outputSizes - Storage size of each output unit (one value per output material, or the product's size).
 * @param inputSizes - Storage size per unit of each input material (same order as `inputCoeffs`).
 * @param inputCoeffs - Required quantity of each input material per unit of raw production.
 * @returns Net storage change per unit of raw production.
 */
export function computeNetStoragePerOutputUnit(
  outputSizes: number[],
  inputSizes: number[],
  inputCoeffs: number[],
): number {
  const outputSpace = outputSizes.reduce((sum, s) => sum + s, 0)
  const inputSpace = inputSizes.reduce((sum, s, i) => sum + s * (inputCoeffs[i] ?? 0), 0)
  return outputSpace - inputSpace
}

/**
 * Limit raw production to what the warehouse can actually store.
 *
 * Scales `rawProduction` by 10 (game cycles per second) then caps it at the maximum
 * number of output units that fit in the warehouse's current free space, when the
 * net storage per output unit is positive.
 *
 * @param rawProduction - The base raw production value.
 * @param freeSpace - Available free space in the warehouse (size - sizeUsed).
 * @param netStoragePerOutputUnit - Net storage change per unit of raw production.
 * @returns The limited raw production value.
 */
export function computeLimitedRawProduction(
  rawProduction: number,
  freeSpace: number,
  netStoragePerOutputUnit: number,
): number {
  const scaled = rawProduction * 10

  if (netStoragePerOutputUnit <= 0) {
    return scaled
  }

  const maxOutputUnits = freeSpace / netStoragePerOutputUnit
  return Math.min(scaled, maxOutputUnits)
}

/**
 * Compute the combined production multiplier granted by unlocked researches.
 *
 * Each entry in {@link RESEARCH_PRODUCTION_MULTIPLIERS} that `hasResearched` returns
 * `true` for contributes its multiplier; all active multipliers are combined by multiplication.
 *
 * @param hasResearched - Returns `true` when the named research is unlocked.
 * @returns The combined research production multiplier (always ≥ 1.0).
 */
export function computeResearchProductionMultiplier(hasResearched: (name: CorpResearchName) => boolean): number {
  return (Object.entries(RESEARCH_PRODUCTION_MULTIPLIERS) as [CorpResearchName, number][]).reduce(
    (mult, [name, value]) => (hasResearched(name) ? mult * value : mult),
    1,
  )
}

/**
 * Reactive service that computes the **total limited raw production** for every
 * division × city pair at the start of each PRODUCTION phase (triggered when the
 * corporation's previous state was `PURCHASE`).
 *
 * The resulting `totalRawProduction$` map is the primary input for {@link SmartSupply}
 * when calculating how much of each input material to buy.
 */
@injectable('Singleton')
export class TotalRawProduction {
  /**
   * Observable that emits an accumulated `Record<"divisionName|cityName", totalRaw>` map
   * each time the corporation transitions out of PURCHASE state.
   *
   * The map grows as each division × city pair is processed and resets on every new
   * PRODUCTION tick via the inner `switchMap → scan` pattern.
   */
  readonly totalRawProduction$: Observable<Record<string, number>> = this.corporation.previousStateOf$('PURCHASE').pipe(
    // only act when we just transitioned out of PURCHASE (prevState === 'PURCHASE')
    filter(Boolean),
    switchMap(() =>
      this.divisions.eachDivisionNameAndCityName$().pipe(
        mergeMap(({ divisionName, cityName }) => this._computeForCity$(divisionName, cityName)),
        // accumulate each city's entry; scan resets automatically on next switchMap trigger
        scan((acc, entry) => ({ ...acc, ...entry }), {} as Record<string, number>),
      ),
    ),
    shareReplay(1),
  )

  /**
   * Alias for {@link totalRawProduction$}.
   * Provided to satisfy the {@link TotalRawProductionMock} interface shape.
   */
  readonly rawProduction$: Observable<Record<string, number>> = this.totalRawProduction$

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Corporation)
    private readonly corporation: Corporation,

    @inject(Divisions)
    private readonly divisions: Divisions,

    @inject(Offices)
    private readonly offices: Offices,

    @inject(Warehouses)
    private readonly warehouses: Warehouses,

    @inject(IndustryData)
    private readonly industryData: IndustryData,

    @inject(MaterialData)
    private readonly materialData: MaterialData,
  ) {}

  /**
   * Compute the total limited raw production for a single division × city pair.
   *
   * Sums `getLimitedRawProduction` across:
   * - all output materials if the division makes materials, and
   * - every finished product if the division makes products.
   *
   * @param divisionName - The name of the division.
   * @param cityName - The city to compute for.
   * @returns Observable emitting `{ ["divisionName|cityName"]: totalRaw }` and completing.
   */
  private _computeForCity$(divisionName: string, cityName: CityName): Observable<Record<string, number>> {
    return combineLatest({
      division: this.divisions.divisionFor$(divisionName),
      office: this.offices.infoFor$(divisionName, cityName),
      warehouse: this.warehouses.warehouseFor$(divisionName, cityName),
      industryData: this.industryData.data$().pipe(first()),
      materialData: this.materialData.data$().pipe(first()),
      upgradeLevels: this.corporation.upgradeLevels$().pipe(first()),
      hasResearched: this.corporation.hasResearched$().pipe(first()),
    }).pipe(
      first(),
      map(({ division, office, warehouse, industryData, materialData, upgradeLevels, hasResearched }) => {
        const industry = industryData[division.type as CorpIndustryName]
        const smartFactoriesLevel = upgradeLevels['Smart Factories'] ?? 0
        const freeSpace = warehouse.size - warehouse.sizeUsed

        const researchMult = computeResearchProductionMultiplier(
          (name) => hasResearched[delimited(divisionName, name)] ?? false,
        )

        // Input sizes and coefficients are shared across all outputs
        const inputEntries = Object.entries(industry.requiredMaterials) as [CorpMaterialName, number][]
        const inputSizes = inputEntries.map(([name]) => materialData[name]?.size ?? 0)
        const inputCoeffs = inputEntries.map(([, coeff]) => coeff)

        let total = 0

        if (industry.makesMaterials) {
          const outputSizes = (industry.producedMaterials ?? []).map(
            (name) => materialData[name as CorpMaterialName]?.size ?? 0,
          )
          const rawProd = computeRawProduction(office, division, smartFactoriesLevel, researchMult, false)
          const netStorage = computeNetStoragePerOutputUnit(outputSizes, inputSizes, inputCoeffs)
          total += computeLimitedRawProduction(rawProd, freeSpace, netStorage)
        }

        if (division.makesProducts) {
          const finishedProducts = division.products
            .map((name) => this.ns.corporation.getProduct(divisionName, cityName, name) as Product)
            .filter((p) => p.developmentProgress >= 100)

          for (const product of finishedProducts) {
            const rawProd = computeRawProduction(office, division, smartFactoriesLevel, researchMult, true)
            const netStorage = computeNetStoragePerOutputUnit([product.size], inputSizes, inputCoeffs)
            total += computeLimitedRawProduction(rawProd, freeSpace, netStorage)
          }
        }

        return { [delimited(divisionName, cityName)]: total }
      }),
    )
  }
}
