import { makeTestScheduler } from '__helpers__/test-scheduler'
import type {
  CityName,
  CorpIndustryData,
  CorpIndustryName,
  CorpMaterialName,
  CorpStateName,
  Division,
  Material,
  Warehouse,
} from '@ns'
import { createNsMock } from '@ns-mock'
import { of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'

import { CorporationMock, createCorporationMock } from '../__mocks__/corporation'
import { createDivisionsMock, DivisionsMock } from '../__mocks__/divisions'
import { createIndustryDataMock, IndustryDataMock } from '../__mocks__/industry-data'
import { createTotalRawProductionMock, TotalRawProductionMock } from '../__mocks__/total-raw-production'
import { createWarehousesMock, WarehousesMock } from '../__mocks__/warehouses'
import type { Corporation } from '../corporation'
import type { Divisions } from '../divisions'
import type { IndustryData } from '../industry-data'
import type { Warehouses } from '../warehouses'
import { SmartSupply } from '.'
import type { TotalRawProduction } from './total-raw-production'

// --- Fixture factories ---

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

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    name: 'Plants' as CorpMaterialName,
    stored: 0,
    quality: 0,
    demand: undefined,
    competition: undefined,
    buyAmount: 0,
    actualSellAmount: 0,
    productionAmount: 0,
    importAmount: 0,
    marketPrice: 0,
    desiredSellPrice: 'MP',
    desiredSellAmount: 'PROD',
    exports: [],
    ...overrides,
  }
}

/** Industry data: Agriculture requires 1 unit of Plants per unit of raw production. */
const INDUSTRY_DATA = {
  Agriculture: {
    requiredMaterials: { ['Plants' as CorpMaterialName]: 1 },
  } as CorpIndustryData,
} as Record<CorpIndustryName, CorpIndustryData>

// --- Suite ---

describe('SmartSupply', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let divisionsMock: DivisionsMock
  let totalRawProductionMock: TotalRawProductionMock
  let industryDataMock: IndustryDataMock
  let warehousesMock: WarehousesMock
  let testScheduler: TestScheduler

  /** Creates a new {@link SmartSupply} instance with all mocked dependencies. */
  const getSut = () =>
    new SmartSupply(
      mockNs,
      corporationMock as unknown as Corporation,
      divisionsMock as unknown as Divisions,
      totalRawProductionMock as unknown as TotalRawProduction,
      industryDataMock as unknown as IndustryData,
      warehousesMock as unknown as Warehouses,
    )

  beforeEach(() => {
    mockNs = createNsMock()
    corporationMock = createCorporationMock()
    divisionsMock = createDivisionsMock()
    totalRawProductionMock = createTotalRawProductionMock()
    industryDataMock = createIndustryDataMock()
    warehousesMock = createWarehousesMock()
    testScheduler = makeTestScheduler()
  })

  describe('smartSupply$', () => {
    test('should not emit when previousStateOf$ emits false', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold('a', { a: false }))
        corporationMock.nextState$.mockReturnValue(cold(''))
        expectObservable(getSut().smartSupply$).toBe('')
      })
    })

    test('should emit the first totalRawProduction$ snapshot when previousStateOf$ transitions to true', () => {
      const snapshot = { 'AgriCorp|Aevum': 42 }

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold('a', { a: true }))
        corporationMock.nextState$.mockReturnValue(cold(''))
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: snapshot })
        expectObservable(getSut().smartSupply$).toBe('a', { a: snapshot })
      })
    })

    test('should not re-emit for consecutive true values (distinct guard)', () => {
      const snapshot = { 'AgriCorp|Aevum': 42 }

      testScheduler.run(({ cold, expectObservable }) => {
        // second `true` is a duplicate — distinct() suppresses it
        corporationMock.previousStateOf$.mockReturnValue(cold('aa', { a: true }))
        corporationMock.nextState$.mockReturnValue(cold(''))
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: snapshot })
        expectObservable(getSut().smartSupply$).toBe('a', { a: snapshot })
      })
    })
  })

  describe('_beforePurchase$', () => {
    test('should not emit when nextState$ never transitions to PURCHASE', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold(''))
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'START' as CorpStateName }))
        expectObservable(getSut()._beforePurchase$).toBe('')
      })
    })

    test('should emit a buy record per required material when PURCHASE is triggered', () => {
      // Plants coefficient = 1, totalRawProduction = 100 → required = 100; warehouse holds 1000; no inventory → buy 100
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const rawProd = { 'AgriCorp|Aevum': 100 }

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold(''))
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: rawProd })

        expectObservable(getSut()._beforePurchase$).toBe('a', {
          a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName, materialName: 'Plants', amount: 100 },
        })
      })
    })

    test('should only trigger once even when PURCHASE appears twice (distinct deduplication)', () => {
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const rawProd = { 'AgriCorp|Aevum': 100 }

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold(''))
        // PURCHASE at frame 10 and frame 30; distinct() blocks the second true
        corporationMock.nextState$.mockReturnValue(cold('-a-a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: rawProd })

        // only one emission at frame 10; second PURCHASE at frame 30 is suppressed
        expectObservable(getSut()._beforePurchase$).toBe('-a', {
          a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName, materialName: 'Plants', amount: 100 },
        })
      })
    })

    test('should subtract existing inventory from the required purchase amount', () => {
      // 30 units already stored → buy 100 - 30 = 70
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const rawProd = { 'AgriCorp|Aevum': 100 }
      const storedMaterial = makeMaterial({ stored: 30 })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([storedMaterial]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold(''))
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: rawProd })

        expectObservable(getSut()._beforePurchase$).toBe('a', {
          a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName, materialName: 'Plants', amount: 70 },
        })
      })
    })

    test('should scale purchase amounts down when total required exceeds warehouse capacity', () => {
      // Required = 10000 (Plants coeff 1 × 10000); warehouse size = 100 → multiplier = 100/10000 → buy 100
      const division = makeDivision()
      const smallWarehouse = makeWarehouse({ size: 100 })
      const rawProd = { 'AgriCorp|Aevum': 10000 }

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(smallWarehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold(''))
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: rawProd })

        expectObservable(getSut()._beforePurchase$).toBe('a', {
          a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName, materialName: 'Plants', amount: 100 },
        })
      })
    })

    test('should increment the congestion counter when a city has non-zero production output', () => {
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const rawProd = { 'AgriCorp|Aevum': 100 }
      // Non-zero productionAmount drives the congestion counter
      const producingMaterial = makeMaterial({ productionAmount: 5 })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([producingMaterial]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))

      let sut!: SmartSupply

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold(''))
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: rawProd })

        sut = getSut()
        expectObservable(sut._beforePurchase$).toBe('a', {
          // stored = 0, so buy 100 - 0 = 100
          a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName, materialName: 'Plants', amount: 100 },
        })
      })

      // side-effect: congestion counter should be set to 1 for this city
      expect(sut.congestion.get('AgriCorp|Aevum')).toBe(1)
    })
  })
})
