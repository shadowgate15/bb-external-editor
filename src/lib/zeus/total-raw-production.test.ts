import { makeTestScheduler } from '__helpers__/test-scheduler'
import type {
  CityName,
  CorpIndustryData,
  CorpIndustryName,
  CorpMaterialConstantData,
  CorpMaterialName,
  CorpResearchName,
  CorpUpgradeName,
  Division,
  Office,
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
import { createOfficesMock, OfficesMock } from './__mocks__/offices'
import { createWarehousesMock, WarehousesMock } from './__mocks__/warehouses'
import type { Corporation } from './corporation'
import type { Divisions } from './divisions'
import type { IndustryData } from './industry-data'
import type { MaterialData } from './material-data'
import type { Offices } from './offices'
import {
  computeLimitedRawProduction,
  computeNetStoragePerOutputUnit,
  computeRawProduction,
  computeResearchProductionMultiplier,
  TotalRawProduction,
} from './total-raw-production'
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

function makeOffice(overrides: Partial<Office> = {}): Office {
  const zeroProd = {
    Operations: 0,
    Engineer: 0,
    Business: 0,
    Management: 0,
    'Research & Development': 0,
    Intern: 0,
    Unassigned: 0,
  } as Record<string, number>

  return {
    city: 'Aevum' as CityName,
    size: 10,
    maxEnergy: 100,
    maxMorale: 100,
    numEmployees: 0,
    avgEnergy: 100,
    avgMorale: 100,
    totalExperience: 0,
    employeeProductionByJob: zeroProd as Office['employeeProductionByJob'],
    employeeJobs: zeroProd as Office['employeeJobs'],
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

function makeProduct(overrides: Partial<Product> = {}): Product {
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
    stored: 100,
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
  Plants: { name: 'Plants', size: 0.05, baseMarkup: 4, demandBase: 100 } as CorpMaterialConstantData,
  Food: { name: 'Food', size: 0.05, baseMarkup: 4, demandBase: 100 } as CorpMaterialConstantData,
  Water: { name: 'Water', size: 0.05, baseMarkup: 4, demandBase: 100 } as CorpMaterialConstantData,
  Chemicals: { name: 'Chemicals', size: 0.1, baseMarkup: 4, demandBase: 100 } as CorpMaterialConstantData,
} as Record<CorpMaterialName, CorpMaterialConstantData>

const UPGRADE_LEVELS = { 'Smart Factories': 0 } as Record<CorpUpgradeName, number>

// --- Suite: computeRawProduction ---

describe('computeRawProduction', () => {
  test('returns 0 when all employee production is 0', () => {
    const office = makeOffice()
    const division = makeDivision()
    expect(computeRawProduction(office, division, 0, 1, false)).toBe(0)
  })

  test('computes correct value for material output with Operations and Engineer employees', () => {
    const office = makeOffice({
      employeeProductionByJob: {
        Operations: 100,
        Engineer: 50,
        Management: 0,
        Business: 0,
        'Research & Development': 0,
        Intern: 0,
        Unassigned: 0,
      } as Office['employeeProductionByJob'],
    })
    const division = makeDivision({ productionMult: 2 })

    const totalProd = 100 + 50 + 0
    const managementFactor = 1 + 0 / (1.2 * totalProd)
    const employeeProd = (Math.pow(100, 0.4) + Math.pow(50, 0.3)) * managementFactor
    const officeMultiplier = 0.05 * employeeProd
    const expected = officeMultiplier * 2 * 1 * 1

    expect(computeRawProduction(office, division, 0, 1, false)).toBeCloseTo(expected, 10)
  })

  test('applies 0.5 balancing factor for product output', () => {
    const office = makeOffice({
      employeeProductionByJob: {
        Operations: 100,
        Engineer: 0,
        Management: 0,
        Business: 0,
        'Research & Development': 0,
        Intern: 0,
        Unassigned: 0,
      } as Office['employeeProductionByJob'],
    })
    const division = makeDivision({ productionMult: 1 })

    const materialRaw = computeRawProduction(office, division, 0, 1, false)
    const productRaw = computeRawProduction(office, division, 0, 1, true)

    expect(productRaw).toBeCloseTo(materialRaw * 0.5, 10)
  })

  test('applies Smart Factories upgrade multiplier', () => {
    const office = makeOffice({
      employeeProductionByJob: {
        Operations: 100,
        Engineer: 0,
        Management: 0,
        Business: 0,
        'Research & Development': 0,
        Intern: 0,
        Unassigned: 0,
      } as Office['employeeProductionByJob'],
    })
    const division = makeDivision()

    const base = computeRawProduction(office, division, 0, 1, false)
    const withUpgrade = computeRawProduction(office, division, 10, 1, false)

    expect(withUpgrade).toBeCloseTo(base * (1 + 0.03 * 10), 10)
  })

  test('applies research production multiplier', () => {
    const office = makeOffice({
      employeeProductionByJob: {
        Operations: 100,
        Engineer: 0,
        Management: 0,
        Business: 0,
        'Research & Development': 0,
        Intern: 0,
        Unassigned: 0,
      } as Office['employeeProductionByJob'],
    })
    const division = makeDivision()

    const base = computeRawProduction(office, division, 0, 1, false)
    const withResearch = computeRawProduction(office, division, 0, 1.1, false)

    expect(withResearch).toBeCloseTo(base * 1.1, 10)
  })

  test('management factor equals 1 when totalProd is 0', () => {
    const office = makeOffice()
    const division = makeDivision({ productionMult: 1 })
    // totalProd = 0, managementFactor should be 1 (not divide-by-zero)
    expect(() => computeRawProduction(office, division, 0, 1, false)).not.toThrow()
  })
})

// --- Suite: computeNetStoragePerOutputUnit ---

describe('computeNetStoragePerOutputUnit', () => {
  test('returns difference between output space and input space', () => {
    // output: Plants(0.05) + Food(0.05) = 0.10
    // input: Water(0.05*0.5) + Chemicals(0.1*0.2) = 0.025 + 0.02 = 0.045
    // net: 0.10 - 0.045 = 0.055
    const result = computeNetStoragePerOutputUnit([0.05, 0.05], [0.05, 0.1], [0.5, 0.2])
    expect(result).toBeCloseTo(0.055, 10)
  })

  test('returns negative value when inputs consume more space than outputs', () => {
    const result = computeNetStoragePerOutputUnit([0.01], [1.0], [2.0])
    expect(result).toBeLessThan(0)
  })

  test('returns 0 for empty arrays', () => {
    expect(computeNetStoragePerOutputUnit([], [], [])).toBe(0)
  })
})

// --- Suite: computeLimitedRawProduction ---

describe('computeLimitedRawProduction', () => {
  test('returns rawProduction * 10 when netStorage <= 0', () => {
    expect(computeLimitedRawProduction(100, 500, -1)).toBe(1000)
    expect(computeLimitedRawProduction(100, 500, 0)).toBe(1000)
  })

  test('caps at warehouse capacity when netStorage > 0 limits output', () => {
    // freeSpace=100, netStorage=1.0 → maxOutput=100; scaled=1000 > 100 → return 100
    expect(computeLimitedRawProduction(100, 100, 1.0)).toBe(100)
  })

  test('returns scaled value when warehouse has ample space', () => {
    // freeSpace=100000, netStorage=0.1 → maxOutput=1000000; scaled=1000 < 1000000 → return 1000
    expect(computeLimitedRawProduction(100, 100_000, 0.1)).toBe(1000)
  })
})

// --- Suite: computeResearchProductionMultiplier ---

describe('computeResearchProductionMultiplier', () => {
  test('returns 1.0 when no researches are unlocked', () => {
    expect(computeResearchProductionMultiplier(() => false)).toBe(1)
  })

  test('returns 1.1 when only Self-Correcting Assemblers is unlocked', () => {
    const hasResearched = (name: CorpResearchName) => name === 'Self-Correcting Assemblers'
    expect(computeResearchProductionMultiplier(hasResearched)).toBeCloseTo(1.1, 10)
  })

  test('returns 1.2 when only Drones - Assembly is unlocked', () => {
    const hasResearched = (name: CorpResearchName) => name === 'Drones - Assembly'
    expect(computeResearchProductionMultiplier(hasResearched)).toBeCloseTo(1.2, 10)
  })

  test('returns 1.1 * 1.2 = 1.32 when both production researches are unlocked', () => {
    const hasResearched = (name: CorpResearchName) =>
      name === 'Self-Correcting Assemblers' || name === 'Drones - Assembly'
    expect(computeResearchProductionMultiplier(hasResearched)).toBeCloseTo(1.1 * 1.2, 10)
  })
})

// --- Suite: TotalRawProduction service ---

describe('TotalRawProduction', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let divisionsMock: DivisionsMock
  let officesMock: OfficesMock
  let warehousesMock: WarehousesMock
  let industryDataMock: IndustryDataMock
  let materialDataMock: MaterialDataMock
  let testScheduler: TestScheduler

  const getSut = () =>
    new TotalRawProduction(
      mockNs,
      corporationMock as unknown as Corporation,
      divisionsMock as unknown as Divisions,
      officesMock as unknown as Offices,
      warehousesMock as unknown as Warehouses,
      industryDataMock as unknown as IndustryData,
      materialDataMock as unknown as MaterialData,
    )

  beforeEach(() => {
    mockNs = createNsMock()
    corporationMock = createCorporationMock()
    divisionsMock = createDivisionsMock()
    officesMock = createOfficesMock()
    warehousesMock = createWarehousesMock()
    industryDataMock = createIndustryDataMock()
    materialDataMock = createMaterialDataMock()
    testScheduler = makeTestScheduler()
  })

  describe('totalRawProduction$', () => {
    test('should not emit when previousStateOf$ never emits true', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold('a', { a: false }))
        expectObservable(getSut().totalRawProduction$).toBe('')
      })
    })

    test('should emit accumulated totals for a material division', () => {
      const division = makeDivision({ makesProducts: false })
      const office = makeOffice({
        employeeProductionByJob: {
          Operations: 100,
          Engineer: 0,
          Management: 0,
          Business: 0,
          'Research & Development': 0,
          Intern: 0,
          Unassigned: 0,
        } as Office['employeeProductionByJob'],
      })
      const warehouse = makeWarehouse({ size: 1_000_000, sizeUsed: 0 })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockReturnValue(of(office))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      corporationMock.upgradeLevels$.mockReturnValue(of(UPGRADE_LEVELS))
      corporationMock.hasResearched$.mockReturnValue(of({} as Record<string, boolean>))

      // Compute expected value
      const researchMult = 1
      const rawProd = computeRawProduction(office, division, 0, researchMult, false)
      const outputSizes = [MATERIAL_DATA['Plants'].size, MATERIAL_DATA['Food'].size]
      const inputSizes = [MATERIAL_DATA['Water'].size, MATERIAL_DATA['Chemicals'].size]
      const inputCoeffs = [0.5, 0.2]
      const netStorage = computeNetStoragePerOutputUnit(outputSizes, inputSizes, inputCoeffs)
      const freeSpace = warehouse.size - warehouse.sizeUsed
      const expectedTotal = computeLimitedRawProduction(rawProd, freeSpace, netStorage)

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold('a', { a: true }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        expectObservable(getSut().totalRawProduction$).toBe('a', {
          a: { [`${DIVISION_NAME}|${CITY}`]: expectedTotal },
        })
      })
    })

    test('should emit zero total for a product division with no finished products', () => {
      const division = makeDivision({ makesProducts: true, products: ['Widget'] })
      const office = makeOffice({
        employeeProductionByJob: {
          Operations: 100,
          Engineer: 0,
          Management: 0,
          Business: 0,
          'Research & Development': 0,
          Intern: 0,
          Unassigned: 0,
        } as Office['employeeProductionByJob'],
      })
      const warehouse = makeWarehouse({ size: 1_000_000, sizeUsed: 0 })
      // Product is not finished (developmentProgress < 100)
      const unfinishedProduct = makeProduct({ developmentProgress: 50 })

      jest.mocked(mockNs.corporation.getProduct).mockReturnValue(unfinishedProduct)

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockReturnValue(of(office))
      warehousesMock.warehouseFor$.mockReturnValue(of(warehouse))
      industryDataMock.data$.mockReturnValue(
        of({
          Tobacco: {
            ...AGRI_INDUSTRY_DATA,
            makesMaterials: false,
            makesProducts: true,
            producedMaterials: [],
          },
        } as unknown as Record<CorpIndustryName, CorpIndustryData>),
      )
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      corporationMock.upgradeLevels$.mockReturnValue(of(UPGRADE_LEVELS))
      corporationMock.hasResearched$.mockReturnValue(of({} as Record<string, boolean>))

      const tobaccoDivision = makeDivision({
        type: 'Tobacco' as CorpIndustryName,
        makesProducts: true,
        products: ['Widget'],
      })

      divisionsMock.divisionFor$.mockReturnValue(of(tobaccoDivision))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.previousStateOf$.mockReturnValue(cold('a', { a: true }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        expectObservable(getSut().totalRawProduction$).toBe('a', {
          a: { [`${DIVISION_NAME}|${CITY}`]: 0 },
        })
      })
    })

    test('rawProduction$ is the same observable instance as totalRawProduction$', () => {
      // Provide a minimal mock so the class field initializer does not throw
      corporationMock.previousStateOf$.mockReturnValue(of(false))
      const sut = getSut()
      expect(sut.rawProduction$).toBe(sut.totalRawProduction$)
    })
  })
})
