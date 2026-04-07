import 'reflect-metadata'

import { inject, injectable } from 'inversify'
import { combineLatest, first, last, map, mergeMap, Observable, of, scan, shareReplay, single } from 'rxjs'

import { NSIdentifier } from '@/lib/ns.identifier'

import { Corporation } from '../corporation'
import { delimited } from '../delimited'
import { Divisions } from '../divisions'
import { IndustryData } from '../industry-data'
import { MaterialData } from '../material-data'
import { Offices } from '../offices'
import { Warehouses } from '../warehouses'
import { calculateRawProduction } from './calculate-raw-production'
import { getLimitedRawProduction } from './get-limited-raw-production'

/**
 * Computes per-city raw and warehouse-limited production rates for every division.
 *
 * Two observables are provided:
 * - `rawProduction$` — unconstrained production rate, based on office staffing, upgrades, and research.
 * - `totalRawProduction$` — production rate capped by available warehouse space.
 *
 * Both observables emit an ever-growing `Record<string, number>` keyed by
 * `delimited(divisionName, cityName)`. They grow as new division/city pairs are
 * observed from `eachDivisionNameAndCityName$` and update whenever any upstream
 * value changes.
 *
 * `rawProduction$` is eagerly subscribed in the constructor so its `shareReplay(1)`
 * cache is warm before `totalRawProduction$` first tries to read from it.
 */
@injectable('Singleton')
export class TotalRawProduction {
  /**
   * Accumulated map of unconstrained raw production rates, keyed by
   * `delimited(divisionName, cityName)`.
   *
   * The value for each key is the theoretical output per cycle — calculated from
   * office employee production stats, Smart Factories upgrade level, and applicable
   * assembly researches — without accounting for available warehouse space.
   *
   * Emits a new accumulated snapshot whenever any upstream value changes for any
   * division/city pair. Never completes.
   */
  readonly rawProduction$: Observable<Record<string, number>> = this.divisions.eachDivisionNameAndCityName$().pipe(
    mergeMap(({ divisionName, cityName }) =>
      combineLatest({
        division: this.divisions.divisionFor$(divisionName),
        cityName: of(cityName),
        office: this.offices.infoFor$(divisionName, cityName),
        smartFactoryLevel: this.corporation.upgradeLevelFor$('Smart Factories'),
        hasDronesAssembly: this.corporation.hasResearchedFor$(divisionName, 'Drones - Assembly'),
        hasSelfCorrectingAssemblers: this.corporation.hasResearchedFor$(divisionName, 'Self-Correcting Assemblers'),
        hasUpgradeFulcrum: this.corporation.hasResearchedFor$(divisionName, 'uPgrade: Fulcrum'),
      }).pipe(last(), single()),
    ),
    map(
      ({
        division,
        cityName,
        office,
        smartFactoryLevel,
        hasDronesAssembly,
        hasSelfCorrectingAssemblers,
        hasUpgradeFulcrum,
      }) => ({
        divisionName: division.name,
        cityName,
        rawProduction: calculateRawProduction({
          industry: division.type,
          operationsEmployeeProduction: office.employeeProductionByJob.Operations,
          engineerEmployeeProduction: office.employeeProductionByJob.Engineer,
          managementEmployeeProduction: office.employeeProductionByJob.Management,
          makesProducts: division.makesProducts,
          productionMultiplier: division.productionMult,
          smartFactoryLevel,
          hasDronesAssembly,
          hasSelfCorrectingAssemblers,
          hasUpgradeFulcrum,
        }),
      }),
    ),
    scan(
      (acc, { divisionName, cityName, rawProduction }) => ({
        ...acc,
        [delimited(divisionName, cityName)]: rawProduction,
      }),
      {} as Record<string, number>,
    ),
    shareReplay(1),
  )

  /**
   * Accumulated map of warehouse-limited production rates, keyed by
   * `delimited(divisionName, cityName)`.
   *
   * Extends `rawProduction$` by capping each city's output to what will physically
   * fit in its warehouse during the current cycle, factoring in the unit size of
   * each produced material or product and the warehouse's current free space.
   *
   * Emits a new accumulated snapshot whenever any upstream value changes for any
   * division/city pair. Never completes.
   */
  readonly totalRawProduction$: Observable<Record<string, number>> = this.divisions.eachDivisionNameAndCityName$().pipe(
    mergeMap(({ divisionName, cityName }) =>
      combineLatest({
        division: this.divisions.divisionFor$(divisionName).pipe(single()),
        cityName: of(cityName),
        rawProduction: this.rawProduction$.pipe(
          map((rawProduction) => rawProduction[delimited(divisionName, cityName)]),
          first((v) => v !== undefined),
        ),
      }).pipe(last(), single()),
    ),
    mergeMap(({ division, cityName, rawProduction }) =>
      combineLatest({
        division: of(division),
        cityName: of(cityName),
        rawProduction: of(rawProduction),
        outputUnitSpace: this.materialData.data$(),
        producedMaterials: this.industryData.data$().pipe(
          map((industryData) => industryData[division.type].producedMaterials),
          single(),
        ),
        warehouseFreeSpace: this.warehouses.warehouseFor$(division.name, cityName).pipe(
          map((warehouse) => warehouse.size - warehouse.sizeUsed),
          single(),
        ),
        products: this.divisions.divisionCityProductsFor$(division.name, cityName).pipe(single()),
      }).pipe(last()),
    ),
    map(({ division, cityName, rawProduction, outputUnitSpace, producedMaterials, warehouseFreeSpace, products }) => ({
      division,
      cityName,
      totalRawProduction: getLimitedRawProduction({
        rawProduction,
        outputUnitSpace,
        producedMaterials,
        warehouseFreeSpace,
        products,
      }),
    })),
    scan(
      (acc, { division, cityName, totalRawProduction }) => ({
        ...acc,
        [delimited(division.name, cityName)]: totalRawProduction,
      }),
      {} as Record<string, number>,
    ),
    shareReplay(1),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Offices)
    private readonly offices: Offices,

    @inject(Divisions)
    private readonly divisions: Divisions,

    @inject(Corporation)
    private readonly corporation: Corporation,

    @inject(MaterialData)
    private readonly materialData: MaterialData,

    @inject(IndustryData)
    private readonly industryData: IndustryData,

    @inject(Warehouses)
    private readonly warehouses: Warehouses,
  ) {
    // Eagerly start rawProduction$ so shareReplay(1) cache is populated
    // before totalRawProduction$ looks up values from it.
    this.rawProduction$.subscribe()
  }
}
