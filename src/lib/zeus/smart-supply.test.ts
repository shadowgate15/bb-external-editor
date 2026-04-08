import { makeTestScheduler } from '__helpers__/test-scheduler'
import type {
  CityName,
  CorpIndustryData,
  CorpIndustryName,
  CorpMaterialConstantData,
  CorpMaterialName,
  CorpStateName,
  CorpUpgradeName,
  Division,
  Material,
  Product,
  Warehouse,
} from '@ns'
import { createNsMock } from '@ns-mock'
import { of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'

import { CorporationMock, createCorporationMock } from './__mocks__/corporation'
import { createDivisionsMock, DivisionsMock } from './__mocks__/divisions'
import { createIndustryDataMock, IndustryDataMock } from './__mocks__/industry-data'
import { createMaterialDataMock, MaterialDataMock } from './__mocks__/material-data'
import { createTotalRawProductionMock, TotalRawProductionMock } from './__mocks__/total-raw-production'
import { createWarehousesMock, WarehousesMock } from './__mocks__/warehouses'
import type { Corporation } from './corporation'
import type { Divisions } from './divisions'
import type { IndustryData } from './industry-data'
import type { MaterialData } from './material-data'
import { computeInputRequirements, SmartSupply } from './smart-supply'
import type { TotalRawProduction } from './total-raw-production'
import type { Warehouses } from './warehouses'

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
    city: 'Aevum' as CityName,
    level: 1,
    size: 1000,
    sizeUsed: 0,
    smartSupplyEnabled: false,
    ...overrides,
  }
}

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    name: 'Water' as CorpMaterialName,
    stored: 0,
    quality: 50,
    demand: undefined,
    competition: undefined,
    buyAmount: 0,
    actualSellAmount: 0,
    productionAmount: 10,
    importAmount: 0,
    marketPrice: 5,
    desiredSellPrice: 'MP',
    desiredSellAmount: 'MAX',
    exports: [],
    ...overrides,
  }
}

function _makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    name: 'Widget',
    demand: undefined,
    competition: undefined,
    rating: 100,
    effectiveRating: 100,
    stats: { quality: 100, performance: 100, durability: 100, reliability: 100, aesthetics: 100, features: 100 },
    productionCost: 1000,
    desiredSellPrice: 'MP',
    desiredSellAmount: 'MAX',
    stored: 0,
    productionAmount: 10,
    actualSellAmount: 0,
    developmentProgress: 100,
    advertisingInvestment: 0,
    designInvestment: 0,
    size: 0.2,
    ...overrides,
  }
}

// --- Shared fixtures ---

const CITY = 'Aevum' as CityName
const DIVISION_NAME = 'AgriCorp'

const AGRI_INDUSTRY_DATA: CorpIndustryData = {
  startingCost: 0,
  description: '',
  recommendStarting: false,
  requiredMaterials: { Water: 0.5, Chemicals: 0.2 } as Partial<Record<CorpMaterialName, number>>,
  producedMaterials: ['Plants', 'Food'] as CorpMaterialName[],
  makesMaterials: true,
  makesProducts: false,
}

const INDUSTRY_DATA = {
  Agriculture: AGRI_INDUSTRY_DATA,
} as Record<CorpIndustryName, CorpIndustryData>

const MATERIAL_DATA = {
  Water: { name: 'Water', size: 0.05, baseMarkup: 4, demandBase: 100 } as CorpMaterialConstantData,
  Chemicals: { name: 'Chemicals', size: 0.1, baseMarkup: 4, demandBase: 100 } as CorpMaterialConstantData,
  Plants: { name: 'Plants', size: 0.05, baseMarkup: 4, demandBase: 100 } as CorpMaterialConstantData,
  Food: { name: 'Food', size: 0.05, baseMarkup: 4, demandBase: 100 } as CorpMaterialConstantData,
} as Record<CorpMaterialName, CorpMaterialConstantData>

const _UPGRADE_LEVELS = { 'Smart Factories': 0 } as Record<CorpUpgradeName, number>

// --- Suite: computeInputRequirements ---

describe('computeInputRequirements', () => {
  const requiredMaterials = { Water: 0.5, Chemicals: 0.2 } as Partial<Record<CorpMaterialName, number>>
  const materialSizes = { Water: 0.05, Chemicals: 0.1 }

  test('computes correct quantities with no stored materials and ample space', () => {
    const result = computeInputRequirements(1000, requiredMaterials, {}, materialSizes, 999_999)
    expect(result['Water']).toBeCloseTo(500, 5)
    expect(result['Chemicals']).toBeCloseTo(200, 5)
  })

  test('deducts stored amounts from required quantities', () => {
    const stored = { Water: 100, Chemicals: 50 }
    const result = computeInputRequirements(1000, requiredMaterials, stored, materialSizes, 999_999)
    expect(result['Water']).toBeCloseTo(400, 5)
    expect(result['Chemicals']).toBeCloseTo(150, 5)
  })

  test('clamps to zero when stored exceeds required', () => {
    const stored = { Water: 9999, Chemicals: 9999 }
    const result = computeInputRequirements(1000, requiredMaterials, stored, materialSizes, 999_999)
    expect(result['Water']).toBe(0)
    expect(result['Chemicals']).toBe(0)
  })

  test('scales down when total input size exceeds free space', () => {
    // With totalRaw=1000: Water=500*0.05=25, Chemicals=200*0.1=20, total=45
    // freeSpace=22.5 → spaceMult=22.5/45=0.5
    const result = computeInputRequirements(1000, requiredMaterials, {}, materialSizes, 22.5)
    expect(result['Water']).toBeCloseTo(250, 5)
    expect(result['Chemicals']).toBeCloseTo(100, 5)
  })

  test('returns empty record when requiredMaterials is empty', () => {
    const result = computeInputRequirements(1000, {}, {}, materialSizes, 1000)
    expect(result).toEqual({})
  })

  test('returns zero quantities when totalRawProduction is 0', () => {
    const result = computeInputRequirements(0, requiredMaterials, {}, materialSizes, 999_999)
    expect(result['Water']).toBe(0)
    expect(result['Chemicals']).toBe(0)
  })
})

// --- Suite: SmartSupply service ---

describe('SmartSupply', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let divisionsMock: DivisionsMock
  let warehousesMock: WarehousesMock
  let industryDataMock: IndustryDataMock
  let materialDataMock: MaterialDataMock
  let totalRawProductionMock: TotalRawProductionMock
  let testScheduler: TestScheduler

  const getSut = () =>
    new SmartSupply(
      mockNs,
      corporationMock as unknown as Corporation,
      divisionsMock as unknown as Divisions,
      warehousesMock as unknown as Warehouses,
      industryDataMock as unknown as IndustryData,
      materialDataMock as unknown as MaterialData,
      totalRawProductionMock as unknown as TotalRawProduction,
    )

  beforeEach(() => {
    mockNs = createNsMock()
    corporationMock = createCorporationMock()
    divisionsMock = createDivisionsMock()
    warehousesMock = createWarehousesMock()
    industryDataMock = createIndustryDataMock()
    materialDataMock = createMaterialDataMock()
    totalRawProductionMock = createTotalRawProductionMock()
    testScheduler = makeTestScheduler()
  })

  describe('purchaseMaterials$', () => {
    test('should not emit when nextState$ never emits PURCHASE', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'SALE' as CorpStateName }))
        expectObservable(getSut().purchaseMaterials$).toBe('')
      })
    })

    test('should call buyMaterial for each input when not congested', () => {
      const division = makeDivision()
      const warehouse = makeWarehouse({ size: 1_000_000, sizeUsed: 0 })
      const totalRaw = 1000
      const key = `${DIVISION_NAME}|${CITY}`

      // Output materials have non-zero productionAmount → not congested
      jest
        .mocked(mockNs.corporation.getMaterial)
        .mockImplementation((_, __, name) =>
          makeMaterial({ name: name as CorpMaterialName, productionAmount: 10, stored: 0 }),
        )

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      totalRawProductionMock.totalRawProduction$ = of({ [key]: totalRaw })

      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().purchaseMaterials$.subscribe()
      })

      expect(mockNs.corporation.buyMaterial).toHaveBeenCalledWith(DIVISION_NAME, CITY, 'Water', 500)
      expect(mockNs.corporation.buyMaterial).toHaveBeenCalledWith(DIVISION_NAME, CITY, 'Chemicals', 200)
    })

    test('should discard input materials when warehouse is congested', () => {
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const key = `${DIVISION_NAME}|${CITY}`

      // All outputs show productionAmount = 0 (congested)
      jest.mocked(mockNs.corporation.getMaterial).mockReturnValue(makeMaterial({ productionAmount: 0 }))

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      totalRawProductionMock.totalRawProduction$ = of({ [key]: 1000 })

      // Run 6 cycles to exceed congestion threshold (> 5)
      let _cycle = 0
      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(
          cold('abcdef', {
            a: 'PURCHASE' as CorpStateName,
            b: 'PURCHASE' as CorpStateName,
            c: 'PURCHASE' as CorpStateName,
            d: 'PURCHASE' as CorpStateName,
            e: 'PURCHASE' as CorpStateName,
            f: 'PURCHASE' as CorpStateName,
          }),
        )
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().purchaseMaterials$.subscribe(() => {
          _cycle++
        })
      })

      // After 6 cycles of zero production, sellMaterial should be called (discarding inputs)
      expect(mockNs.corporation.sellMaterial).toHaveBeenCalledWith(DIVISION_NAME, CITY, 'Water', 'MAX', '0')
      expect(mockNs.corporation.sellMaterial).toHaveBeenCalledWith(DIVISION_NAME, CITY, 'Chemicals', 'MAX', '0')
    })

    test('should reset sell orders when congestion clears', () => {
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const key = `${DIVISION_NAME}|${CITY}`

      // First 6 cycles: zero production → enter congestion; 7th cycle: production resumes
      let plantsCallCount = 0
      jest.mocked(mockNs.corporation.getMaterial).mockImplementation((_div, _city, name) => {
        if (name === 'Plants') {
          plantsCallCount++
          // Return productive on the 7th check (after 6 congested cycles)
          return makeMaterial({ productionAmount: plantsCallCount > 6 ? 10 : 0, stored: 0 })
        }
        return makeMaterial({ productionAmount: 0, stored: 0 })
      })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      totalRawProductionMock.totalRawProduction$ = of({ [key]: 1000 })

      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(
          cold('abcdefg', {
            a: 'PURCHASE' as CorpStateName,
            b: 'PURCHASE' as CorpStateName,
            c: 'PURCHASE' as CorpStateName,
            d: 'PURCHASE' as CorpStateName,
            e: 'PURCHASE' as CorpStateName,
            f: 'PURCHASE' as CorpStateName,
            g: 'PURCHASE' as CorpStateName,
          }),
        )
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().purchaseMaterials$.subscribe()
      })

      // On the 7th cycle (first recovery), sell orders should be reset to stop discarding
      expect(mockNs.corporation.sellMaterial).toHaveBeenCalledWith(DIVISION_NAME, CITY, 'Water', '0', 'MP')
      expect(mockNs.corporation.sellMaterial).toHaveBeenCalledWith(DIVISION_NAME, CITY, 'Chemicals', '0', 'MP')
    })

    test('should reset congestion counter when production resumes', () => {
      const division = makeDivision()
      const warehouse = makeWarehouse()
      const key = `${DIVISION_NAME}|${CITY}`

      // Alternate between zero and non-zero production
      let callCount = 0
      jest.mocked(mockNs.corporation.getMaterial).mockImplementation(() => {
        callCount++
        // Non-zero on first call, zero on subsequent
        return makeMaterial({ productionAmount: callCount === 1 ? 10 : 0 })
      })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      totalRawProductionMock.totalRawProduction$ = of({ [key]: 0 })

      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().purchaseMaterials$.subscribe()
      })

      // First cycle has production, so no congestion mitigation
      expect(mockNs.corporation.sellMaterial).not.toHaveBeenCalledWith(DIVISION_NAME, CITY, 'Water', 'MAX', '0')
    })
  })
})
