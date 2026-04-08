import { makeTestScheduler } from '__helpers__/test-scheduler'
import type {
  CityName,
  CorpIndustryData,
  CorpIndustryName,
  CorpMaterialConstantData,
  CorpMaterialName,
  Division,
  Office,
  Warehouse,
} from '@ns'
import { createNsMock } from '@ns-mock'
import { of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'

import { CorporationMock, createCorporationMock } from '../__mocks__/corporation'
import { createDivisionsMock, DivisionsMock } from '../__mocks__/divisions'
import { createIndustryDataMock, IndustryDataMock } from '../__mocks__/industry-data'
import { createMaterialDataMock, MaterialDataMock } from '../__mocks__/material-data'
import { createOfficesMock, OfficesMock } from '../__mocks__/offices'
import { createWarehousesMock, WarehousesMock } from '../__mocks__/warehouses'
import type { Corporation } from '../corporation'
import type { Divisions } from '../divisions'
import type { IndustryData } from '../industry-data'
import type { MaterialData } from '../material-data'
import type { Offices } from '../offices'
import type { Warehouses } from '../warehouses'
import { calculateRawProduction } from './calculate-raw-production'
import { getLimitedRawProduction } from './get-limited-raw-production'
import { TotalRawProduction } from './total-raw-production'

function makeDivision(overrides: Partial<Division> = {}): Division {
  return {
    name: 'AgriCorp',
    type: 'Agriculture' as CorpIndustryName,
    awareness: 0,
    popularity: 0,
    productionMult: 1,
    researchPoints: 0,
    lastCycleRevenue: 0,
    lastCycleExpenses: 0,
    thisCycleRevenue: 0,
    thisCycleExpenses: 0,
    numAdVerts: 0,
    cities: ['Aevum' as CityName],
    products: [],
    makesProducts: false,
    maxProducts: 0,
    ...overrides,
  }
}

function makeOffice(overrides: Partial<Office> = {}): Office {
  return {
    city: 'Aevum' as CityName,
    size: 3,
    maxEnergy: 100,
    maxMorale: 100,
    numEmployees: 3,
    avgEnergy: 100,
    avgMorale: 100,
    totalExperience: 0,
    employeeProductionByJob: {
      Operations: 100,
      Engineer: 100,
      Business: 0,
      Management: 100,
      'Research & Development': 0,
      Intern: 0,
      Unassigned: 0,
    },
    employeeJobs: {
      Operations: 1,
      Engineer: 1,
      Business: 0,
      Management: 1,
      'Research & Development': 0,
      Intern: 0,
      Unassigned: 0,
    },
    ...overrides,
  }
}

function makeWarehouse(overrides: Partial<Warehouse> = {}): Warehouse {
  return {
    level: 1,
    city: 'Aevum' as CityName,
    size: 1000,
    sizeUsed: 0,
    smartSupplyEnabled: false,
    ...overrides,
  }
}

const MATERIAL_DATA = {
  Water: { name: 'Water', size: 0.05 } as CorpMaterialConstantData,
} as Record<CorpMaterialName, CorpMaterialConstantData>

const INDUSTRY_DATA = {
  Agriculture: { producedMaterials: ['Water' as CorpMaterialName] } as CorpIndustryData,
} as Record<CorpIndustryName, CorpIndustryData>

describe('TotalRawProduction (v2)', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let divisionsMock: DivisionsMock
  let officesMock: OfficesMock
  let corporationMock: CorporationMock
  let materialDataMock: MaterialDataMock
  let industryDataMock: IndustryDataMock
  let warehousesMock: WarehousesMock
  let testScheduler: TestScheduler

  /** Creates a new {@link TotalRawProduction} instance with all mocked dependencies. */
  const getSut = () =>
    new TotalRawProduction(
      mockNs,
      officesMock as unknown as Offices,
      divisionsMock as unknown as Divisions,
      corporationMock as unknown as Corporation,
      materialDataMock as unknown as MaterialData,
      industryDataMock as unknown as IndustryData,
      warehousesMock as unknown as Warehouses,
    )

  beforeEach(() => {
    mockNs = createNsMock()
    divisionsMock = createDivisionsMock()
    officesMock = createOfficesMock()
    corporationMock = createCorporationMock()
    materialDataMock = createMaterialDataMock()
    industryDataMock = createIndustryDataMock()
    warehousesMock = createWarehousesMock()
    testScheduler = makeTestScheduler()
  })

  describe('rawProduction$', () => {
    test('should emit a record keyed "divisionName|cityName" with the calculated raw production', () => {
      const division = makeDivision()
      const office = makeOffice()
      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockReturnValue(of(office))
      corporationMock.upgradeLevelFor$.mockReturnValue(of(0))
      corporationMock.hasResearchedFor$.mockReturnValue(of(false))

      const expectedRawProduction = calculateRawProduction({
        industry: division.type,
        operationsEmployeeProduction: office.employeeProductionByJob.Operations,
        engineerEmployeeProduction: office.employeeProductionByJob.Engineer,
        managementEmployeeProduction: office.employeeProductionByJob.Management,
        makesProducts: division.makesProducts,
        productionMultiplier: division.productionMult,
        smartFactoryLevel: 0,
        hasDronesAssembly: false,
        hasSelfCorrectingAssemblers: false,
        hasUpgradeFulcrum: false,
      })

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        expectObservable(getSut().rawProduction$).toBe('a', {
          a: { 'AgriCorp|Aevum': expectedRawProduction },
        })
      })
    })

    test('should accumulate entries as additional pairs arrive', () => {
      const division = makeDivision()
      const officeAevum = makeOffice({ city: 'Aevum' as CityName })
      const officeSector = makeOffice({ city: 'Sector-12' as CityName })
      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockImplementation((_, cityName) => of(cityName === 'Aevum' ? officeAevum : officeSector))
      corporationMock.upgradeLevelFor$.mockReturnValue(of(0))
      corporationMock.hasResearchedFor$.mockReturnValue(of(false))

      const sharedOpts = {
        industry: division.type,
        makesProducts: division.makesProducts,
        productionMultiplier: division.productionMult,
        smartFactoryLevel: 0,
        hasDronesAssembly: false,
        hasSelfCorrectingAssemblers: false,
        hasUpgradeFulcrum: false,
      }
      const rawProdAevum = calculateRawProduction({
        ...sharedOpts,
        operationsEmployeeProduction: officeAevum.employeeProductionByJob.Operations,
        engineerEmployeeProduction: officeAevum.employeeProductionByJob.Engineer,
        managementEmployeeProduction: officeAevum.employeeProductionByJob.Management,
      })
      const rawProdSector = calculateRawProduction({
        ...sharedOpts,
        operationsEmployeeProduction: officeSector.employeeProductionByJob.Operations,
        engineerEmployeeProduction: officeSector.employeeProductionByJob.Engineer,
        managementEmployeeProduction: officeSector.employeeProductionByJob.Management,
      })

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('ab', {
            a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName },
            b: { divisionName: 'AgriCorp', cityName: 'Sector-12' as CityName },
          }),
        )
        expectObservable(getSut().rawProduction$).toBe('ab', {
          a: { 'AgriCorp|Aevum': rawProdAevum },
          b: { 'AgriCorp|Aevum': rawProdAevum, 'AgriCorp|Sector-12': rawProdSector },
        })
      })
    })

    test('should emit nothing when no pairs arrive', () => {
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(cold(''))
        getSut().rawProduction$.subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })
  })

  describe('totalRawProduction$', () => {
    test('should emit a record keyed "divisionName|cityName" with the limited raw production', () => {
      const division = makeDivision()
      const office = makeOffice()
      const warehouse = makeWarehouse()
      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockReturnValue(of(office))
      corporationMock.upgradeLevelFor$.mockReturnValue(of(0))
      corporationMock.hasResearchedFor$.mockReturnValue(of(false))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))

      const rawProduction = calculateRawProduction({
        industry: division.type,
        operationsEmployeeProduction: office.employeeProductionByJob.Operations,
        engineerEmployeeProduction: office.employeeProductionByJob.Engineer,
        managementEmployeeProduction: office.employeeProductionByJob.Management,
        makesProducts: division.makesProducts,
        productionMultiplier: division.productionMult,
        smartFactoryLevel: 0,
        hasDronesAssembly: false,
        hasSelfCorrectingAssemblers: false,
        hasUpgradeFulcrum: false,
      })
      const expected = getLimitedRawProduction({
        rawProduction,
        outputUnitSpace: MATERIAL_DATA,
        producedMaterials: INDUSTRY_DATA['Agriculture'].producedMaterials,
        warehouseFreeSpace: warehouse.size - warehouse.sizeUsed,
        products: [],
      })

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        expectObservable(getSut().totalRawProduction$).toBe('a', {
          a: { 'AgriCorp|Aevum': expected },
        })
      })
    })

    test('should accumulate entries as additional pairs arrive', () => {
      const division = makeDivision()
      const officeAevum = makeOffice({ city: 'Aevum' as CityName })
      const officeSector = makeOffice({ city: 'Sector-12' as CityName })
      const warehouseAevum = makeWarehouse({ city: 'Aevum' as CityName })
      const warehouseSector = makeWarehouse({ city: 'Sector-12' as CityName, size: 2000, sizeUsed: 500 })
      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockImplementation((_, cityName) => of(cityName === 'Aevum' ? officeAevum : officeSector))
      corporationMock.upgradeLevelFor$.mockReturnValue(of(0))
      corporationMock.hasResearchedFor$.mockReturnValue(of(false))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      warehousesMock.warehouseFor$.mockImplementation((_, cityName) =>
        of(cityName === 'Aevum' ? warehouseAevum : warehouseSector),
      )
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))

      const sharedOpts = {
        industry: division.type,
        makesProducts: division.makesProducts,
        productionMultiplier: division.productionMult,
        smartFactoryLevel: 0,
        hasDronesAssembly: false,
        hasSelfCorrectingAssemblers: false,
        hasUpgradeFulcrum: false,
      }
      const rawProdAevum = calculateRawProduction({
        ...sharedOpts,
        operationsEmployeeProduction: officeAevum.employeeProductionByJob.Operations,
        engineerEmployeeProduction: officeAevum.employeeProductionByJob.Engineer,
        managementEmployeeProduction: officeAevum.employeeProductionByJob.Management,
      })
      const rawProdSector = calculateRawProduction({
        ...sharedOpts,
        operationsEmployeeProduction: officeSector.employeeProductionByJob.Operations,
        engineerEmployeeProduction: officeSector.employeeProductionByJob.Engineer,
        managementEmployeeProduction: officeSector.employeeProductionByJob.Management,
      })
      const limitedAevum = getLimitedRawProduction({
        rawProduction: rawProdAevum,
        outputUnitSpace: MATERIAL_DATA,
        producedMaterials: INDUSTRY_DATA['Agriculture'].producedMaterials,
        warehouseFreeSpace: warehouseAevum.size - warehouseAevum.sizeUsed,
        products: [],
      })
      const limitedSector = getLimitedRawProduction({
        rawProduction: rawProdSector,
        outputUnitSpace: MATERIAL_DATA,
        producedMaterials: INDUSTRY_DATA['Agriculture'].producedMaterials,
        warehouseFreeSpace: warehouseSector.size - warehouseSector.sizeUsed,
        products: [],
      })

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('ab', {
            a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName },
            b: { divisionName: 'AgriCorp', cityName: 'Sector-12' as CityName },
          }),
        )
        expectObservable(getSut().totalRawProduction$).toBe('ab', {
          a: { 'AgriCorp|Aevum': limitedAevum },
          b: { 'AgriCorp|Aevum': limitedAevum, 'AgriCorp|Sector-12': limitedSector },
        })
      })
    })

    test('should emit nothing when no pairs arrive', () => {
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(cold(''))
        getSut().totalRawProduction$.subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })
  })
})
