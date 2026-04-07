import 'reflect-metadata'

import { inject, injectable } from 'inversify'
import { combineLatest, last, map, mergeMap, Observable, of, reduce, shareReplay, single } from 'rxjs'

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

@injectable('Singleton')
export class TotalRawProduction {
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
    reduce(
      (acc, { divisionName, cityName, rawProduction }) => ({ ...acc, [divisionName + '-' + cityName]: rawProduction }),
      {},
    ),
    shareReplay(1),
  )

  readonly totalRawProduction$: Observable<Record<string, number>> = this.divisions.eachDivisionNameAndCityName$().pipe(
    mergeMap(({ divisionName, cityName }) =>
      combineLatest({
        division: this.divisions.divisionFor$(divisionName).pipe(single()),
        cityName: of(cityName),
        rawProduction: this.rawProduction$.pipe(
          map((rawProduction) => rawProduction[delimited(divisionName, cityName)]),
          single(),
        ),
      }).pipe(last(), single()),
    ),
    mergeMap(({ division, cityName, rawProduction }) =>
      combineLatest({
        division: of(division),
        cityName: of(cityName),
        rawProduction: of(rawProduction),
        outputUnitSpace: this.materialData.data$,
        producedMaterials: this.industryData.data$.pipe(
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
    reduce(
      (acc, { division, cityName, totalRawProduction }) => ({
        ...acc,
        [delimited(division.name, cityName)]: totalRawProduction,
      }),
      {},
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
  ) {}
}
