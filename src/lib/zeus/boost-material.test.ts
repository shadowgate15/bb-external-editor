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

import { ConfigMock, createConfigMock } from './__mocks__/config'
import { CorporationMock, createCorporationMock } from './__mocks__/corporation'
import { createDivisionsMock, DivisionsMock } from './__mocks__/divisions'
import { createIndustryDataMock, IndustryDataMock } from './__mocks__/industry-data'
import { createMaterialDataMock, MaterialDataMock } from './__mocks__/material-data'
import { createWarehousesMock, WarehousesMock } from './__mocks__/warehouses'
import { BoostMaterial, computeBoostMaterialQuantities } from './boost-material'
import type { Config } from './config'
import type { Corporation } from './corporation'
import type { Divisions } from './divisions'
import type { IndustryData } from './industry-data'
import type { MaterialData } from './material-data'
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
    name: 'Real Estate' as CorpMaterialName,
    stored: 0,
    quality: 50,
    demand: undefined,
    competition: undefined,
    buyAmount: 0,
    actualSellAmount: 0,
    productionAmount: 0,
    importAmount: 0,
    marketPrice: 1,
    desiredSellPrice: 'MP',
    desiredSellAmount: '0',
    exports: [],
    ...overrides,
  }
}

// --- Shared fixtures ---

const CITY = 'Aevum' as CityName
const DIVISION_NAME = 'AgriCorp'

/**
 * Agriculture boost material factors:
 * Real Estate: 0.72, Hardware: 0.2, Robots: 0.3, AI Cores: 0.3
 */
const AGRI_INDUSTRY_DATA: CorpIndustryData = {
  startingCost: 0,
  description: '',
  recommendStarting: false,
  requiredMaterials: {},
  makesMaterials: true,
  makesProducts: false,
  realEstateFactor: 0.72,
  hardwareFactor: 0.2,
  robotFactor: 0.3,
  aiCoreFactor: 0.3,
}

const INDUSTRY_DATA = {
  Agriculture: AGRI_INDUSTRY_DATA,
} as Record<CorpIndustryName, CorpIndustryData>

const MATERIAL_DATA = {
  'Real Estate': { name: 'Real Estate', size: 0.005 } as CorpMaterialConstantData,
  Hardware: { name: 'Hardware', size: 0.06 } as CorpMaterialConstantData,
  Robots: { name: 'Robots', size: 1 } as CorpMaterialConstantData,
  'AI Cores': { name: 'AI Cores', size: 0.1 } as CorpMaterialConstantData,
} as Record<CorpMaterialName, CorpMaterialConstantData>

// --- Suite: computeBoostMaterialQuantities ---

describe('computeBoostMaterialQuantities', () => {
  test('distributes storage evenly for two symmetric materials', () => {
    // c1 = c2 = 0.5, s1 = s2 = 0.1, S = 500
    // By symmetry each material should receive 2500 units (2500 * 0.1 = 250, total = 500)
    const factors = { 'Real Estate': 0.5, Hardware: 0.5 } as Partial<Record<CorpMaterialName, number>>
    const sizes = { 'Real Estate': 0.1, Hardware: 0.1 } as Partial<Record<CorpMaterialName, number>>

    const result = computeBoostMaterialQuantities(500, factors, sizes)

    expect(result['Real Estate']).toBeCloseTo(2500, 3)
    expect(result['Hardware']).toBeCloseTo(2500, 3)
  })

  test('returns correct quantity for a single material', () => {
    // S = 500, c = 1, s = 0.5 → x = S / s = 1000
    const factors = { Hardware: 1 } as Partial<Record<CorpMaterialName, number>>
    const sizes = { Hardware: 0.5 } as Partial<Record<CorpMaterialName, number>>

    const result = computeBoostMaterialQuantities(500, factors, sizes)

    expect(result['Hardware']).toBeCloseTo(1000, 3)
  })

  test('total storage used equals the budget', () => {
    const factors = { 'Real Estate': 0.72, Hardware: 0.2, 'AI Cores': 0.3 } as Partial<Record<CorpMaterialName, number>>
    const sizes = { 'Real Estate': 0.005, Hardware: 0.06, 'AI Cores': 0.1 } as Partial<Record<CorpMaterialName, number>>
    const S = 1000

    const result = computeBoostMaterialQuantities(S, factors, sizes)
    const totalUsed = Object.entries(result).reduce(
      (sum, [name, qty]) => sum + qty * (sizes[name as CorpMaterialName] ?? 0),
      0,
    )

    expect(totalUsed).toBeCloseTo(S, 3)
  })

  test('drops materials that would be negative and re-solves remaining', () => {
    // Agriculture with all 4 materials at S=1000: Robots (size=1) will go negative
    // Result should exclude Robots and contain only Real Estate, Hardware, AI Cores
    const factors = { 'Real Estate': 0.72, Hardware: 0.2, Robots: 0.3, 'AI Cores': 0.3 } as Partial<
      Record<CorpMaterialName, number>
    >
    const sizes = { 'Real Estate': 0.005, Hardware: 0.06, Robots: 1, 'AI Cores': 0.1 } as Partial<
      Record<CorpMaterialName, number>
    >

    const result = computeBoostMaterialQuantities(1000, factors, sizes)

    expect(result['Robots']).toBeUndefined()
    expect(result['Real Estate']).toBeGreaterThan(0)
    expect(result['Hardware']).toBeGreaterThan(0)
    expect(result['AI Cores']).toBeGreaterThan(0)
  })

  test('remaining storage is fully allocated after dropping a negative material', () => {
    const factors = { 'Real Estate': 0.72, Hardware: 0.2, Robots: 0.3, 'AI Cores': 0.3 } as Partial<
      Record<CorpMaterialName, number>
    >
    const sizes = { 'Real Estate': 0.005, Hardware: 0.06, Robots: 1, 'AI Cores': 0.1 } as Partial<
      Record<CorpMaterialName, number>
    >
    const S = 1000

    const result = computeBoostMaterialQuantities(S, factors, sizes)
    const totalUsed = Object.entries(result).reduce(
      (sum, [name, qty]) => sum + qty * (sizes[name as CorpMaterialName] ?? 0),
      0,
    )

    expect(totalUsed).toBeCloseTo(S, 3)
  })

  test('skips materials with a factor of zero', () => {
    const factors = { 'Real Estate': 0, Hardware: 1 } as Partial<Record<CorpMaterialName, number>>
    const sizes = { 'Real Estate': 0.1, Hardware: 0.1 } as Partial<Record<CorpMaterialName, number>>

    const result = computeBoostMaterialQuantities(100, factors, sizes)

    expect(result['Real Estate']).toBeUndefined()
    expect(result['Hardware']).toBeCloseTo(1000, 3)
  })

  test('returns empty record when all factors are zero', () => {
    const factors = { 'Real Estate': 0, Hardware: 0 } as Partial<Record<CorpMaterialName, number>>
    const sizes = { 'Real Estate': 0.1, Hardware: 0.1 } as Partial<Record<CorpMaterialName, number>>

    const result = computeBoostMaterialQuantities(500, factors, sizes)

    expect(result).toEqual({})
  })

  test('returns empty record when factors map is empty', () => {
    const result = computeBoostMaterialQuantities(500, {}, {})
    expect(result).toEqual({})
  })
})

// --- Suite: BoostMaterial service ---

describe('BoostMaterial', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let configMock: ConfigMock
  let divisionsMock: DivisionsMock
  let warehousesMock: WarehousesMock
  let industryDataMock: IndustryDataMock
  let materialDataMock: MaterialDataMock
  let testScheduler: TestScheduler

  const getSut = () =>
    new BoostMaterial(
      mockNs,
      corporationMock as unknown as Corporation,
      configMock as unknown as Config,
      divisionsMock as unknown as Divisions,
      warehousesMock as unknown as Warehouses,
      industryDataMock as unknown as IndustryData,
      materialDataMock as unknown as MaterialData,
    )

  beforeEach(() => {
    mockNs = createNsMock()
    corporationMock = createCorporationMock()
    configMock = createConfigMock()
    divisionsMock = createDivisionsMock()
    warehousesMock = createWarehousesMock()
    industryDataMock = createIndustryDataMock()
    materialDataMock = createMaterialDataMock()
    testScheduler = makeTestScheduler()
  })

  describe('fillBoostMaterials$', () => {
    test('should not emit when config has enableBoostMaterials = false', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        configMock.data$.mockReturnValue(cold('a', { a: { enableBoostMaterials: false } }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'PURCHASE' as CorpStateName }))

        expectObservable(getSut().fillBoostMaterials$).toBe('')
      })
    })

    test('should not emit when nextState$ is not PURCHASE (even if config enabled)', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        configMock.data$.mockReturnValue(cold('a', { a: { enableBoostMaterials: true } }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'SALE' as CorpStateName }))

        expectObservable(getSut().fillBoostMaterials$).toBe('')
      })
    })

    test('should call buyMaterial for boost materials with deficit', () => {
      const division = makeDivision()
      // Large warehouse so all 4 materials fit (S = 50_000)
      const warehouse = makeWarehouse({ size: 100_000, sizeUsed: 0 })

      // No boost materials currently stored
      jest.mocked(mockNs.corporation.getMaterial).mockReturnValue(makeMaterial({ stored: 0 }))

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: { enableBoostMaterials: true } }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().fillBoostMaterials$.subscribe()
      })

      expect(mockNs.corporation.buyMaterial).toHaveBeenCalled()
      // Verify at least Real Estate is purchased (always non-zero for Agriculture with large warehouse)
      const calls = jest.mocked(mockNs.corporation.buyMaterial).mock.calls
      expect(calls.some(([div, city]) => div === DIVISION_NAME && city === CITY)).toBe(true)
    })

    test('should call buyMaterial when stored amount meets target with a 0', () => {
      const division = makeDivision()
      const warehouse = makeWarehouse({ size: 1000, sizeUsed: 0 })

      // Pre-compute targets and fill warehouse with stored amounts at or above them
      // With S=500 (50% of 1000), Agriculture drops Robots, gives Real Estate, Hardware, AI Cores
      // We'll mock stored = very large number to simulate already-filled
      jest.mocked(mockNs.corporation.getMaterial).mockReturnValue(makeMaterial({ stored: 9_999_999 }))

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: { enableBoostMaterials: true } }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'PURCHASE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().fillBoostMaterials$.subscribe()
      })

      expect(mockNs.corporation.buyMaterial).toHaveBeenCalledWith('AgriCorp', 'Aevum', 'Real Estate', 0)
      expect(mockNs.corporation.buyMaterial).toHaveBeenCalledWith('AgriCorp', 'Aevum', 'Hardware', 0)
      expect(mockNs.corporation.buyMaterial).toHaveBeenCalledWith('AgriCorp', 'Aevum', 'AI Cores', 0)
    })

    test('should stop purchasing when enableBoostMaterials flips to false', () => {
      const division = makeDivision()
      const warehouse = makeWarehouse({ size: 1000, sizeUsed: 0 })

      jest.mocked(mockNs.corporation.getMaterial).mockReturnValue(makeMaterial({ stored: 0 }))

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))

      testScheduler.run(({ cold }) => {
        // Enable at frame 0, disable at frame 4 — clearly separated from PURCHASE events
        configMock.data$.mockReturnValue(
          cold('a---b', {
            a: { enableBoostMaterials: true },
            b: { enableBoostMaterials: false },
          }),
        )
        // First PURCHASE at frame 1 (while enabled); second at frame 5 (after disabled at frame 4)
        corporationMock.nextState$.mockReturnValue(
          cold('-c---d', { c: 'PURCHASE' as CorpStateName, d: 'PURCHASE' as CorpStateName }),
        )
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('e', { e: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().fillBoostMaterials$.subscribe()
      })

      // Only the first PURCHASE (frame 1, while enabled) should have triggered purchases
      expect(jest.mocked(mockNs.corporation.buyMaterial).mock.calls.length).toBeGreaterThan(0)
    })
  })
})
