import { makeTestScheduler } from '__helpers__/test-scheduler'
import type {
  CityName,
  CorpIndustryData,
  CorpIndustryName,
  CorpMaterialConstantData,
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
import { createMaterialDataMock, MaterialDataMock } from '../__mocks__/material-data'
import { createTotalRawProductionMock, TotalRawProductionMock } from '../__mocks__/total-raw-production'
import { createWarehousesMock, WarehousesMock } from '../__mocks__/warehouses'
import type { Corporation } from '../corporation'
import type { Divisions } from '../divisions'
import type { IndustryData } from '../industry-data'
import type { MaterialData } from '../material-data'
import type { Warehouses } from '../warehouses'
import { SmartSupplyV2 } from '.'
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

/** Plants size = 1 for easy scale-down math (1 unit = 1 storage). */
const MATERIAL_DATA = {
  Plants: { name: 'Plants', size: 1 } as CorpMaterialConstantData,
} as Record<CorpMaterialName, CorpMaterialConstantData>

// --- Suite ---

describe('SmartSupplyV2', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let divisionsMock: DivisionsMock
  let totalRawProductionMock: TotalRawProductionMock
  let industryDataMock: IndustryDataMock
  let materialDataMock: MaterialDataMock
  let warehousesMock: WarehousesMock
  let testScheduler: TestScheduler

  /** Creates a new {@link SmartSupplyV2} instance with all mocked dependencies. */
  const getSut = () =>
    new SmartSupplyV2(
      mockNs,
      corporationMock as unknown as Corporation,
      divisionsMock as unknown as Divisions,
      totalRawProductionMock as unknown as TotalRawProduction,
      industryDataMock as unknown as IndustryData,
      materialDataMock as unknown as MaterialData,
      warehousesMock as unknown as Warehouses,
    )

  beforeEach(() => {
    mockNs = createNsMock()
    corporationMock = createCorporationMock()
    divisionsMock = createDivisionsMock()
    totalRawProductionMock = createTotalRawProductionMock()
    industryDataMock = createIndustryDataMock()
    materialDataMock = createMaterialDataMock()
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
      // Plants coeff=1, TRP=100, size=1; required=100; warehouse size=1000 → no scaling; buy 100
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const rawProd = { 'AgriCorp|Aevum': 100 }

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

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
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold(''))
        // PURCHASE twice in a row — distinct() suppresses the second
        corporationMock.nextState$.mockReturnValue(cold('-a-a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: rawProd })

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
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

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

    test('should scale purchase amounts down when total required exceeds warehouse free space', () => {
      // Plants coeff=1, TRP=10000, size=1 → aligned=10000, totalSize=10000
      // warehouse size=100, sizeUsed=0 → freeSpace=100 → multiplier=100/10000=0.01 → buy 100
      const division = makeDivision()
      const smallWarehouse = makeWarehouse({ size: 100 })
      const rawProd = { 'AgriCorp|Aevum': 10000 }

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(smallWarehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

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

    test('should account for sizeUsed when computing available free space', () => {
      // warehouse size=200, sizeUsed=100 → freeSpace=100 → same scale-down as above
      const division = makeDivision()
      const partiallyFullWarehouse = makeWarehouse({ size: 200, sizeUsed: 100 })
      const rawProd = { 'AgriCorp|Aevum': 10000 }

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(partiallyFullWarehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

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

    test('should increment the congestion counter when productionAmount is 0', () => {
      // productionAmount=0 → congestion counter increments to 1
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const rawProd = { 'AgriCorp|Aevum': 100 }
      const idleMaterial = makeMaterial({ productionAmount: 0 })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([idleMaterial]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

      let sut!: SmartSupplyV2

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold(''))
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: rawProd })

        sut = getSut()
        expectObservable(sut._beforePurchase$).toBe('a', {
          a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName, materialName: 'Plants', amount: 100 },
        })
      })

      expect(sut.congestion.get('AgriCorp|Aevum')).toBe(1)
    })

    test('should clear the congestion counter when productionAmount is non-zero', () => {
      // productionAmount=5 → congestion counter is cleared
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const rawProd = { 'AgriCorp|Aevum': 100 }
      const producingMaterial = makeMaterial({ productionAmount: 5 })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([producingMaterial]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

      let sut!: SmartSupplyV2

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold(''))
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        totalRawProductionMock.totalRawProduction$ = cold('a', { a: rawProd })

        sut = getSut()
        // pre-seed a congestion count to prove it gets cleared
        sut.congestion.set('AgriCorp|Aevum', 3)
        expectObservable(sut._beforePurchase$).toBe('a', {
          a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName, materialName: 'Plants', amount: 100 },
        })
      })

      expect(sut.congestion.has('AgriCorp|Aevum')).toBe(false)
    })
  })
})
