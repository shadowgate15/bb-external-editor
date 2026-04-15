import { makeTestScheduler } from '__helpers__/test-scheduler'
import type {
  CityName,
  CorpIndustryData,
  CorpIndustryName,
  CorpMaterialName,
  CorpStateName,
  CorpUnlockName,
  Division,
  Material,
} from '@ns'
import { createNsMock } from '@ns-mock'
import { of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'

import { CorporationMock, createCorporationMock } from './__mocks__/corporation'
import { createDivisionsMock, DivisionsMock } from './__mocks__/divisions'
import { createIndustryDataMock, IndustryDataMock } from './__mocks__/industry-data'
import { createTotalRawProductionMock, TotalRawProductionMock } from './__mocks__/total-raw-production'
import type { Corporation } from './corporation'
import type { Divisions } from './divisions'
import { computeExportAllocations, ExportManager } from './export-manager'
import type { IndustryData } from './industry-data'
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

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    name: 'Plants' as CorpMaterialName,
    stored: 0,
    quality: 50,
    demand: undefined,
    competition: undefined,
    buyAmount: 0,
    actualSellAmount: 0,
    productionAmount: 0,
    importAmount: 0,
    marketPrice: 5,
    desiredSellPrice: 'MP',
    desiredSellAmount: '0',
    exports: [],
    ...overrides,
  }
}

// --- Shared fixtures ---

const CITY_A = 'Aevum' as CityName
const CITY_B = 'Chongqing' as CityName

const AGRI_DIVISION = makeDivision({ name: 'AgriCorp', type: 'Agriculture' as CorpIndustryName, cities: [CITY_A] })
const CHEM_DIVISION = makeDivision({
  name: 'ChemCorp',
  type: 'Chemical' as CorpIndustryName,
  cities: [CITY_A],
  makesProducts: false,
})
const PHARMA_DIVISION = makeDivision({
  name: 'PharmaCorp',
  type: 'Pharmaceutical' as CorpIndustryName,
  cities: [CITY_A],
  makesProducts: true,
})

const AGRI_INDUSTRY_DATA: CorpIndustryData = {
  startingCost: 0,
  description: '',
  recommendStarting: false,
  requiredMaterials: { Water: 0.5, Chemicals: 0.2 } as Partial<Record<CorpMaterialName, number>>,
  producedMaterials: ['Plants', 'Food'] as CorpMaterialName[],
  makesMaterials: true,
  makesProducts: false,
}

const CHEM_INDUSTRY_DATA: CorpIndustryData = {
  startingCost: 0,
  description: '',
  recommendStarting: false,
  requiredMaterials: { Plants: 1, Water: 0.5 } as Partial<Record<CorpMaterialName, number>>,
  producedMaterials: ['Chemicals'] as CorpMaterialName[],
  makesMaterials: true,
  makesProducts: false,
}

const PHARMA_INDUSTRY_DATA: CorpIndustryData = {
  startingCost: 0,
  description: '',
  recommendStarting: false,
  requiredMaterials: { Plants: 2 } as Partial<Record<CorpMaterialName, number>>,
  producedMaterials: [] as CorpMaterialName[],
  makesMaterials: false,
  makesProducts: true,
}

const INDUSTRY_DATA_AGRI_CHEM = {
  Agriculture: AGRI_INDUSTRY_DATA,
  Chemical: CHEM_INDUSTRY_DATA,
} as unknown as Record<CorpIndustryName, CorpIndustryData>

const INDUSTRY_DATA_ALL = {
  Agriculture: AGRI_INDUSTRY_DATA,
  Chemical: CHEM_INDUSTRY_DATA,
  Pharmaceutical: PHARMA_INDUSTRY_DATA,
} as unknown as Record<CorpIndustryName, CorpIndustryData>

// --- Suite: computeExportAllocations ---

describe('computeExportAllocations', () => {
  test('returns empty array when producers list is empty', () => {
    const result = computeExportAllocations([], [{ key: 'consDiv|city', needed: 100, isProductMaker: false }])
    expect(result).toEqual([])
  })

  test('returns empty array when consumers list is empty', () => {
    const result = computeExportAllocations([{ key: 'prodDiv|city', supply: 100 }], [])
    expect(result).toEqual([])
  })

  test('returns empty array when total supply is zero', () => {
    const result = computeExportAllocations(
      [{ key: 'prodDiv|city', supply: 0 }],
      [{ key: 'consDiv|city', needed: 100, isProductMaker: false }],
    )
    expect(result).toEqual([])
  })

  test('single producer, single consumer: allocates full needed when supply is sufficient', () => {
    const result = computeExportAllocations(
      [{ key: 'prod|A', supply: 1000 }],
      [{ key: 'cons|A', needed: 500, isProductMaker: false }],
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ producerKey: 'prod|A', consumerKey: 'cons|A', amount: 500 })
  })

  test('single producer, single consumer: caps at producer supply when insufficient', () => {
    const result = computeExportAllocations(
      [{ key: 'prod|A', supply: 100 }],
      [{ key: 'cons|A', needed: 500, isProductMaker: false }],
    )
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBeCloseTo(100)
  })

  test('product-making consumer is prioritized over material-making consumer when supply is limited', () => {
    const result = computeExportAllocations(
      [{ key: 'prod|A', supply: 100 }],
      [
        { key: 'material|A', needed: 80, isProductMaker: false },
        { key: 'product|A', needed: 80, isProductMaker: true },
      ],
    )
    const productAlloc = result.find((r) => r.consumerKey === 'product|A')
    const materialAlloc = result.find((r) => r.consumerKey === 'material|A')

    // Product-maker gets its full 80; material-maker gets remaining 20
    expect(productAlloc?.amount).toBeCloseTo(80)
    expect(materialAlloc?.amount).toBeCloseTo(20)
  })

  test('supply covers all consumers: each gets exactly their needed amount', () => {
    const result = computeExportAllocations(
      [{ key: 'prod|A', supply: 1000 }],
      [
        { key: 'cons1|A', needed: 200, isProductMaker: true },
        { key: 'cons2|A', needed: 300, isProductMaker: false },
      ],
    )
    const cons1 = result.find((r) => r.consumerKey === 'cons1|A')
    const cons2 = result.find((r) => r.consumerKey === 'cons2|A')
    expect(cons1?.amount).toBeCloseTo(200)
    expect(cons2?.amount).toBeCloseTo(300)
  })

  test('multiple producers distribute proportionally to each consumer', () => {
    // P1 supply=100, P2 supply=300, total=400; consumer needs 200
    const result = computeExportAllocations(
      [
        { key: 'prod|A', supply: 100 },
        { key: 'prod|B', supply: 300 },
      ],
      [{ key: 'cons|A', needed: 200, isProductMaker: false }],
    )
    const fromA = result.find((r) => r.producerKey === 'prod|A')
    const fromB = result.find((r) => r.producerKey === 'prod|B')

    // P1 fraction = 100/400 = 0.25 → 200 × 0.25 = 50
    // P2 fraction = 300/400 = 0.75 → 200 × 0.75 = 150
    expect(fromA?.amount).toBeCloseTo(50)
    expect(fromB?.amount).toBeCloseTo(150)
  })

  test('skips routes where consumer needed is zero', () => {
    const result = computeExportAllocations(
      [{ key: 'prod|A', supply: 1000 }],
      [{ key: 'cons|A', needed: 0, isProductMaker: false }],
    )
    expect(result).toEqual([])
  })
})

// --- Suite: ExportManager service ---

describe('ExportManager', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let divisionsMock: DivisionsMock
  let industryDataMock: IndustryDataMock
  let totalRawProductionMock: TotalRawProductionMock
  let testScheduler: TestScheduler

  const getSut = () =>
    new ExportManager(
      mockNs,
      corporationMock as unknown as Corporation,
      divisionsMock as unknown as Divisions,
      industryDataMock as unknown as IndustryData,
      totalRawProductionMock as unknown as TotalRawProduction,
    )

  beforeEach(() => {
    mockNs = createNsMock()
    corporationMock = createCorporationMock()
    divisionsMock = createDivisionsMock()
    industryDataMock = createIndustryDataMock()
    totalRawProductionMock = createTotalRawProductionMock()
    testScheduler = makeTestScheduler()
    // Default: Export unlock is purchased
    corporationMock.hasUnlockFor$.mockReturnValue(of(true))
  })

  describe('setupExports$', () => {
    test('does not call exportMaterial when nextState$ never emits EXPORT', () => {
      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'SALE' as CorpStateName }))

        getSut().setupExports$.subscribe()
      })

      expect(mockNs.corporation.exportMaterial).not.toHaveBeenCalled()
    })

    test('calls exportMaterial for each producer→consumer route', () => {
      // AgriCorp produces Plants; ChemCorp requires Plants
      const AGRI_CHEM_KEY = `ChemCorp|${CITY_A}`
      const totalRawProdMap = { [AGRI_CHEM_KEY]: 500 }

      divisionsMock.info$.mockReturnValue(of({ AgriCorp: AGRI_DIVISION, ChemCorp: CHEM_DIVISION }))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA_AGRI_CHEM))
      totalRawProductionMock.totalRawProduction$ = of(totalRawProdMap)

      // AgriCorp/Aevum produces 300 Plants; ChemCorp/Aevum has 0 stored, raw=500, coeff=1 → needs 500
      jest.mocked(mockNs.corporation.getMaterial).mockImplementation((div, _city, mat) => {
        if (div === 'AgriCorp' && mat === 'Plants') return makeMaterial({ productionAmount: 300, stored: 0 })
        if (div === 'AgriCorp' && mat === 'Food') return makeMaterial({ productionAmount: 100, stored: 0 })
        if (div === 'ChemCorp' && mat === 'Plants') return makeMaterial({ productionAmount: 0, stored: 0 })
        return makeMaterial()
      })

      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().setupExports$.subscribe()
      })

      // ChemCorp needs 500 * 1 - 0 = 500, but AgriCorp only produces 300 → exports 300
      expect(mockNs.corporation.exportMaterial).toHaveBeenCalledWith(
        'AgriCorp',
        CITY_A,
        'ChemCorp',
        CITY_A,
        'Plants',
        300,
      )
    })

    test('skips exportMaterial when consumer has enough stored material', () => {
      // ChemCorp has more stored than it needs
      const AGRI_CHEM_KEY = `ChemCorp|${CITY_A}`
      const totalRawProdMap = { [AGRI_CHEM_KEY]: 100 }

      divisionsMock.info$.mockReturnValue(of({ AgriCorp: AGRI_DIVISION, ChemCorp: CHEM_DIVISION }))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA_AGRI_CHEM))
      totalRawProductionMock.totalRawProduction$ = of(totalRawProdMap)

      jest.mocked(mockNs.corporation.getMaterial).mockImplementation((div, _city, mat) => {
        if (div === 'AgriCorp' && mat === 'Plants') return makeMaterial({ productionAmount: 500, stored: 0 })
        if (div === 'AgriCorp' && mat === 'Food') return makeMaterial({ productionAmount: 100, stored: 0 })
        // ChemCorp already has 999 Plants stored, only needs 100 * 1 = 100 → deficit = 0
        if (div === 'ChemCorp' && mat === 'Plants') return makeMaterial({ productionAmount: 0, stored: 999 })
        return makeMaterial()
      })

      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().setupExports$.subscribe()
      })

      expect(mockNs.corporation.exportMaterial).not.toHaveBeenCalledWith(
        'AgriCorp',
        CITY_A,
        'ChemCorp',
        CITY_A,
        'Plants',
        expect.anything(),
      )
    })

    test('prioritizes product-making consumer over material-making consumer when supply is limited', () => {
      // AgriCorp produces Plants; both ChemCorp (materials) and PharmaCorp (products) require Plants
      const CHEM_KEY = `ChemCorp|${CITY_A}`
      const PHARMA_KEY = `PharmaCorp|${CITY_A}`
      // rawProduction: Chem needs 100*1=100 Plants, Pharma needs 100*2=200 Plants
      const totalRawProdMap = { [CHEM_KEY]: 100, [PHARMA_KEY]: 100 }

      divisionsMock.info$.mockReturnValue(
        of({ AgriCorp: AGRI_DIVISION, ChemCorp: CHEM_DIVISION, PharmaCorp: PHARMA_DIVISION }),
      )
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA_ALL))
      totalRawProductionMock.totalRawProduction$ = of(totalRawProdMap)

      // AgriCorp only produces 150 Plants total → not enough for both (need 300)
      jest.mocked(mockNs.corporation.getMaterial).mockImplementation((div, _city, mat) => {
        if (div === 'AgriCorp' && mat === 'Plants') return makeMaterial({ productionAmount: 150, stored: 0 })
        if (div === 'AgriCorp' && mat === 'Food') return makeMaterial({ productionAmount: 50, stored: 0 })
        if (div === 'ChemCorp' && mat === 'Plants') return makeMaterial({ productionAmount: 0, stored: 0 })
        if (div === 'PharmaCorp' && mat === 'Plants') return makeMaterial({ productionAmount: 0, stored: 0 })
        return makeMaterial()
      })

      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().setupExports$.subscribe()
      })

      const exportCalls = jest.mocked(mockNs.corporation.exportMaterial).mock.calls
      const pharmaExport = exportCalls.find((c) => c[2] === 'PharmaCorp')
      const chemExport = exportCalls.find((c) => c[2] === 'ChemCorp')

      // PharmaCorp (makesProducts) gets full 200, but supply=150, so it gets 150
      // ChemCorp gets 0 (none left after PharmaCorp)
      expect(pharmaExport?.[5]).toBeCloseTo(150)
      expect(chemExport).toBeUndefined()
    })

    test('cancels existing exports before setting up new ones (handles restart)', () => {
      const AGRI_CHEM_KEY = `ChemCorp|${CITY_A}`
      const totalRawProdMap = { [AGRI_CHEM_KEY]: 100 }

      divisionsMock.info$.mockReturnValue(of({ AgriCorp: AGRI_DIVISION, ChemCorp: CHEM_DIVISION }))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA_AGRI_CHEM))
      totalRawProductionMock.totalRawProduction$ = of(totalRawProdMap)

      // Simulate stale export from a previous run
      const staleExport = { division: 'ChemCorp', city: CITY_A, amount: '999' }
      jest.mocked(mockNs.corporation.getMaterial).mockImplementation((div, _city, mat) => {
        if (div === 'AgriCorp' && mat === 'Plants')
          return makeMaterial({ productionAmount: 100, stored: 0, exports: [staleExport] })
        if (div === 'AgriCorp' && mat === 'Food') return makeMaterial({ productionAmount: 50, stored: 0 })
        if (div === 'ChemCorp' && mat === 'Plants') return makeMaterial({ productionAmount: 0, stored: 0 })
        return makeMaterial()
      })

      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().setupExports$.subscribe()
      })

      expect(mockNs.corporation.cancelExportMaterial).toHaveBeenCalledWith(
        'AgriCorp',
        CITY_A,
        'ChemCorp',
        CITY_A,
        'Plants',
      )
    })
  })

  describe('clearExports$', () => {
    test('does not call cancelExportMaterial when previousState$ never emits EXPORT', () => {
      testScheduler.run(({ cold }) => {
        corporationMock.previousState$.mockReturnValue(cold('a', { a: 'SALE' as CorpStateName }))

        getSut().clearExports$.subscribe()
      })

      expect(mockNs.corporation.cancelExportMaterial).not.toHaveBeenCalled()
    })

    test('calls cancelExportMaterial for each active export on each produced material', () => {
      divisionsMock.info$.mockReturnValue(of({ AgriCorp: AGRI_DIVISION }))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA_AGRI_CHEM))

      const activeExport = { division: 'ChemCorp', city: CITY_A, amount: '100' }
      jest.mocked(mockNs.corporation.getMaterial).mockImplementation((_div, _city, mat) => {
        if (mat === 'Plants') return makeMaterial({ exports: [activeExport] })
        return makeMaterial()
      })

      testScheduler.run(({ cold }) => {
        corporationMock.previousState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().clearExports$.subscribe()
      })

      expect(mockNs.corporation.cancelExportMaterial).toHaveBeenCalledWith(
        'AgriCorp',
        CITY_A,
        'ChemCorp',
        CITY_A,
        'Plants',
      )
    })

    test('does not call cancelExportMaterial when no exports are active', () => {
      divisionsMock.info$.mockReturnValue(of({ AgriCorp: AGRI_DIVISION }))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA_AGRI_CHEM))

      // No active exports
      jest.mocked(mockNs.corporation.getMaterial).mockReturnValue(makeMaterial({ exports: [] }))

      testScheduler.run(({ cold }) => {
        corporationMock.previousState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().clearExports$.subscribe()
      })

      expect(mockNs.corporation.cancelExportMaterial).not.toHaveBeenCalled()
    })

    test('handles multiple cities and materials correctly', () => {
      const agriMultiCity = makeDivision({ name: 'AgriCorp', cities: [CITY_A, CITY_B] })
      divisionsMock.info$.mockReturnValue(of({ AgriCorp: agriMultiCity }))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA_AGRI_CHEM))

      const exportA = { division: 'ChemCorp', city: CITY_A, amount: '50' }
      const exportB = { division: 'ChemCorp', city: CITY_B, amount: '50' }

      jest.mocked(mockNs.corporation.getMaterial).mockImplementation((_div, city, mat) => {
        if (mat === 'Plants' && city === CITY_A)
          return makeMaterial({ name: 'Plants' as CorpMaterialName, exports: [exportA] })
        if (mat === 'Plants' && city === CITY_B)
          return makeMaterial({ name: 'Plants' as CorpMaterialName, exports: [exportB] })
        return makeMaterial()
      })

      testScheduler.run(({ cold }) => {
        corporationMock.previousState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().clearExports$.subscribe()
      })

      expect(mockNs.corporation.cancelExportMaterial).toHaveBeenCalledWith(
        'AgriCorp',
        CITY_A,
        'ChemCorp',
        CITY_A,
        'Plants',
      )
      expect(mockNs.corporation.cancelExportMaterial).toHaveBeenCalledWith(
        'AgriCorp',
        CITY_B,
        'ChemCorp',
        CITY_B,
        'Plants',
      )
    })
  })

  describe('Export unlock absent', () => {
    beforeEach(() => {
      corporationMock.hasUnlockFor$.mockReturnValue(of(false))
    })

    test('setupExports$ does not call exportMaterial when Export unlock is not purchased', () => {
      const AGRI_CHEM_KEY = `ChemCorp|${CITY_A}`
      const totalRawProdMap = { [AGRI_CHEM_KEY]: 500 }

      divisionsMock.info$.mockReturnValue(of({ AgriCorp: AGRI_DIVISION, ChemCorp: CHEM_DIVISION }))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA_AGRI_CHEM))
      totalRawProductionMock.totalRawProduction$ = of(totalRawProdMap)

      jest.mocked(mockNs.corporation.getMaterial).mockImplementation((div, _city, mat) => {
        if (div === 'AgriCorp' && mat === 'Plants') return makeMaterial({ productionAmount: 300, stored: 0 })
        return makeMaterial()
      })

      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().setupExports$.subscribe()
      })

      expect(mockNs.corporation.exportMaterial).not.toHaveBeenCalled()
    })

    test('clearExports$ does not call cancelExportMaterial when Export unlock is not purchased', () => {
      divisionsMock.info$.mockReturnValue(of({ AgriCorp: AGRI_DIVISION }))
      industryDataMock.data$.mockReturnValue(of(INDUSTRY_DATA_AGRI_CHEM))

      const activeExport = { division: 'ChemCorp', city: CITY_A, amount: '100' }
      jest.mocked(mockNs.corporation.getMaterial).mockImplementation((_div, _city, mat) => {
        if (mat === 'Plants') return makeMaterial({ exports: [activeExport] })
        return makeMaterial()
      })

      testScheduler.run(({ cold }) => {
        corporationMock.previousState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().clearExports$.subscribe()
      })

      expect(mockNs.corporation.cancelExportMaterial).not.toHaveBeenCalled()
    })

    test('setupExports$ checks unlock with the correct unlock name', () => {
      testScheduler.run(({ cold }) => {
        corporationMock.nextState$.mockReturnValue(cold('a', { a: 'EXPORT' as CorpStateName }))
        getSut().setupExports$.subscribe()
      })

      expect(corporationMock.hasUnlockFor$).toHaveBeenCalledWith('Export' as CorpUnlockName)
    })
  })
})
