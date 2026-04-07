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
  Office,
  Product,
} from '@ns'
import { createNsMock } from '@ns-mock'
import { of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'

import { CorporationMock, createCorporationMock } from './__mocks__/corporation'
import { createDivisionsMock, DivisionsMock } from './__mocks__/divisions'
import { createIndustryDataMock, IndustryDataMock } from './__mocks__/industry-data'
import { createMaterialDataMock, MaterialDataMock } from './__mocks__/material-data'
import { createOfficesMock, OfficesMock } from './__mocks__/offices'
import type { Corporation } from './corporation'
import type { Divisions } from './divisions'
import type { IndustryData } from './industry-data'
import type { MaterialData } from './material-data'
import type { Offices } from './offices'
import { computeOptimalPrice, computePotentialSalesVolume, Seller } from './seller'

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

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    name: 'Plants' as CorpMaterialName,
    stored: 100,
    quality: 100,
    demand: undefined,
    competition: undefined,
    buyAmount: 0,
    actualSellAmount: 0,
    productionAmount: 0,
    importAmount: 0,
    marketPrice: 50,
    desiredSellPrice: 'MP',
    desiredSellAmount: 'MAX',
    exports: [],
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

// --- Shared test fixtures ---

const CITY = 'Aevum' as CityName
const DIVISION_NAME = 'AgriCorp'

const INDUSTRY_DATA = {
  Agriculture: {
    advertisingFactor: 0,
    requiredMaterials: {},
    makesMaterials: true,
    makesProducts: false,
  } as CorpIndustryData,
} as Record<CorpIndustryName, CorpIndustryData>

const MATERIAL_DATA = {
  Plants: { baseMarkup: 4 } as CorpMaterialConstantData,
} as Record<CorpMaterialName, CorpMaterialConstantData>

const UPGRADE_LEVELS = { 'ABC SalesBots': 0 } as Record<CorpUpgradeName, number>

// --- Suite: computePotentialSalesVolume ---

describe('computePotentialSalesVolume', () => {
  const division = makeDivision()
  const office = makeOffice()
  const industryData = { advertisingFactor: 0 } as CorpIndustryData

  test('computes correct value with standard inputs', () => {
    const result = computePotentialSalesVolume(1, division, office, industryData, 0, 100, 0)
    // With awareness=0: ratioFactor=0.01; f=0: awarenessFactor=popularityFactor=1; advertFactor=0.01^0.85
    // businessProduction=1: businessFactor=1.0001; marketFactor=100; salesBotsFactor=1
    const expected = 1 * (Math.pow(1, 0.26) + 1 * 0.0001) * Math.pow(1 * 1 * 0.01, 0.85) * 100 * 1
    expect(result).toBeCloseTo(expected, 10)
  })

  test('uses demand=100 when demand is undefined', () => {
    const withDefined = computePotentialSalesVolume(1, division, office, industryData, 0, 100, 0)
    const withUndefined = computePotentialSalesVolume(1, division, office, industryData, 0, undefined, 0)
    expect(withUndefined).toBeCloseTo(withDefined, 10)
  })

  test('uses competition=0 when competition is undefined', () => {
    const withDefined = computePotentialSalesVolume(1, division, office, industryData, 0, 100, 0)
    const withUndefined = computePotentialSalesVolume(1, division, office, industryData, 0, 100, undefined)
    expect(withUndefined).toBeCloseTo(withDefined, 10)
  })

  test('uses advertisingFactor=0 when industryData.advertisingFactor is undefined', () => {
    const withFactor = computePotentialSalesVolume(
      1,
      division,
      office,
      { advertisingFactor: 0 } as CorpIndustryData,
      0,
      100,
      0,
    )
    const withoutFactor = computePotentialSalesVolume(1, division, office, {} as CorpIndustryData, 0, 100, 0)
    expect(withoutFactor).toBeCloseTo(withFactor, 10)
  })

  test('uses ratioFactor=0.01 when awareness is 0, regardless of popularity', () => {
    // High popularity but awareness=0 → ratioFactor clamped to 0.01
    const divZeroAwareness = makeDivision({ awareness: 0, popularity: 1000 })
    // High popularity with matching awareness → ratioFactor≈1 (much higher)
    const divHighAwareness = makeDivision({ awareness: 1000, popularity: 1000 })
    const advertData = { advertisingFactor: 1 } as CorpIndustryData

    const withZero = computePotentialSalesVolume(1, divZeroAwareness, office, advertData, 0, 100, 0)
    const withHigh = computePotentialSalesVolume(1, divHighAwareness, office, advertData, 0, 100, 0)

    expect(withZero).toBeLessThan(withHigh)
  })
})

// --- Suite: computeOptimalPrice ---

describe('computeOptimalPrice', () => {
  test('returns penalty-boosted price when PSV > ESV', () => {
    // stored=100 → ESV=10; PSV=1000 >> ESV
    // price = 0 + 50 * sqrt(1000/10) = 50 * sqrt(100) = 500
    expect(computeOptimalPrice(100, 0, 50, 1000)).toBeCloseTo(500, 10)
  })

  test('returns market price + markupLimit when PSV <= ESV (safe zone)', () => {
    // stored=1000 → ESV=100; PSV=50 < ESV → safe zone
    // price = 1000 + 200 = 1200
    expect(computeOptimalPrice(1000, 1000, 200, 50)).toBeCloseTo(1200, 10)
  })

  test('uses stored=1 when stored is 0 to avoid divide-by-zero', () => {
    // stored=0 → effectiveStored=1 → ESV=0.1; PSV=10 >> ESV
    // price = 100 + 50 * sqrt(10/0.1) = 100 + 50 * sqrt(100) = 600
    expect(computeOptimalPrice(0, 100, 50, 10)).toBeCloseTo(600, 10)
  })
})

// --- Suite: Seller.optimalSellingPrice$ ---

describe('Seller', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let divisionsMock: DivisionsMock
  let officesMock: OfficesMock
  let industryDataMock: IndustryDataMock
  let materialDataMock: MaterialDataMock
  let testScheduler: TestScheduler

  const getSut = () =>
    new Seller(
      mockNs,
      corporationMock as unknown as Corporation,
      divisionsMock as unknown as Divisions,
      officesMock as unknown as Offices,
      industryDataMock as unknown as IndustryData,
      materialDataMock as unknown as MaterialData,
    )

  beforeEach(() => {
    mockNs = createNsMock()
    corporationMock = createCorporationMock()
    divisionsMock = createDivisionsMock()
    officesMock = createOfficesMock()
    industryDataMock = createIndustryDataMock()
    materialDataMock = createMaterialDataMock()
    testScheduler = makeTestScheduler()
  })

  describe('optimalSellingPrice$', () => {
    test('should not emit when nextState$ never emits SALE', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'PURCHASE' as CorpStateName }))
        expectObservable(getSut().optimalSellingPrice$).toBe('')
      })
    })

    test('should emit a material SellRecord with the computed optimal price on SALE', () => {
      const division = makeDivision()
      const office = makeOffice()
      const material = makeMaterial()

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockReturnValue(of(office))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([material]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      corporationMock.upgradeLevels$.mockReturnValue(of(UPGRADE_LEVELS))

      // Compute expected price using the same helpers Seller uses internally
      const markupLimit = material.quality / MATERIAL_DATA[material.name].baseMarkup
      const psv = computePotentialSalesVolume(
        material.quality + 0.001,
        division,
        office,
        INDUSTRY_DATA[division.type],
        0,
        material.demand,
        material.competition,
      )
      const expectedPrice = computeOptimalPrice(material.stored, material.marketPrice, markupLimit, psv)

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'SALE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        expectObservable(getSut().optimalSellingPrice$).toBe('a', {
          a: {
            divisionName: DIVISION_NAME,
            cityName: CITY,
            materialName: 'Plants',
            quantity: material.stored,
            price: expectedPrice,
          },
        })
      })
    })

    test('should exclude materials with zero marketPrice', () => {
      const division = makeDivision()
      const office = makeOffice()
      const zeroPrice = makeMaterial({ marketPrice: 0 })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockReturnValue(of(office))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([zeroPrice]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([]))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      corporationMock.upgradeLevels$.mockReturnValue(of(UPGRADE_LEVELS))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'SALE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        expectObservable(getSut().optimalSellingPrice$).toBe('')
      })
    })

    test('should emit CALIBRATION_PRICE for a product with no cached MarkupLimit', () => {
      const division = makeDivision()
      const office = makeOffice()
      // String desiredSellPrice and zero actualSellAmount → cannot back-calculate MarkupLimit
      const product = makeProduct({ desiredSellPrice: 'MP', actualSellAmount: 0 })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockReturnValue(of(office))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([product]))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      corporationMock.upgradeLevels$.mockReturnValue(of(UPGRADE_LEVELS))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'SALE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        expectObservable(getSut().optimalSellingPrice$).toBe('a', {
          a: {
            divisionName: DIVISION_NAME,
            cityName: CITY,
            productName: 'Widget',
            quantity: product.stored,
            price: 1e15,
          },
        })
      })
    })

    test('should derive MarkupLimit from previous cycle data and emit optimal price', () => {
      const division = makeDivision()
      const office = makeOffice()
      // Previous cycle: desiredSellPrice=1e15 (calibration), actualSellAmount=10 → derive MarkupLimit
      const product = makeProduct({
        desiredSellPrice: 1e15,
        actualSellAmount: 10,
        productionCost: 1000,
        stored: 500,
      })

      divisionsMock.divisionFor$.mockReturnValue(of(division))
      officesMock.infoFor$.mockReturnValue(of(office))
      divisionsMock.divisionCityMaterialsFor$.mockReturnValue(of([]))
      divisionsMock.divisionCityProductsFor$.mockReturnValue(of([product]))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA))
      materialDataMock.data$.mockReturnValue(of(MATERIAL_DATA))
      corporationMock.upgradeLevels$.mockReturnValue(of(UPGRADE_LEVELS))

      // Replicate the MarkupLimit derivation and optimal price computation that Seller performs
      const psv = computePotentialSalesVolume(
        0.5 * Math.pow(Math.max(product.effectiveRating, 0), 0.65),
        division,
        office,
        INDUSTRY_DATA[division.type],
        0,
        product.demand,
        product.competition,
      )
      const markupLimit =
        ((product.desiredSellPrice as number) - product.productionCost) * Math.sqrt(product.actualSellAmount / psv)
      const expectedPrice = computeOptimalPrice(product.stored, product.productionCost, markupLimit, psv)

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'SALE' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        expectObservable(getSut().optimalSellingPrice$).toBe('a', {
          a: {
            divisionName: DIVISION_NAME,
            cityName: CITY,
            productName: 'Widget',
            quantity: product.stored,
            price: expectedPrice,
          },
        })
      })
    })
  })
})
