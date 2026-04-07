import { makeTestScheduler } from '__helpers__/test-scheduler'
import type { CityName, CorpMaterialName, Division, Material, Product } from '@ns'
import { createNsMock } from '@ns-mock'
import { TestScheduler } from 'rxjs/testing'

import { CorporationMock, createCorporationMock } from './__mocks__/corporation'
import type { Corporation } from './corporation'
import { Divisions } from './divisions'

const MATERIAL_NAMES = ['Water', 'Food'] as CorpMaterialName[]

function makeDivision(overrides: Partial<Division> = {}): Division {
  return {
    name: 'AgriCorp',
    type: 'Agriculture',
    awareness: 0,
    popularity: 0,
    productionMult: 1,
    researchPoints: 0,
    lastCycleRevenue: 0,
    lastCycleExpenses: 0,
    thisCycleRevenue: 0,
    thisCycleExpenses: 0,
    numAdVerts: 0,
    cities: [],
    products: [],
    makesProducts: false,
    maxProducts: 0,
    ...overrides,
  } as unknown as Division
}

describe('Divisions', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let testScheduler: TestScheduler

  const getSut = () => new Divisions(mockNs, corporationMock as unknown as Corporation)

  beforeEach(() => {
    mockNs = createNsMock()
    corporationMock = createCorporationMock()
    testScheduler = makeTestScheduler()

    jest.mocked(mockNs.corporation.getConstants).mockReturnValue({
      materialNames: MATERIAL_NAMES,
    } as unknown as ReturnType<typeof mockNs.corporation.getConstants>)
  })

  test('should be defined', () => {
    expect(getSut()).toBeDefined()
  })

  describe('info$', () => {
    test('should return the same observable instance on every call', () => {
      const sut = getSut()
      expect(sut.info$()).toBe(sut.info$())
    })

    test('should emit a record keyed by division name', () => {
      const div = makeDivision({ name: 'AgriCorp' })
      jest.mocked(mockNs.corporation.getDivision).mockReturnValue(div)

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().info$()).toBe('a', { a: { AgriCorp: div } })
      })
    })

    test('should emit a record containing all divisions', () => {
      const agri = makeDivision({ name: 'AgriCorp' })
      const tech = makeDivision({ name: 'TechCorp' })
      jest.mocked(mockNs.corporation.getDivision).mockImplementation((name) => (name === 'AgriCorp' ? agri : tech))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp', 'TechCorp'] }))
        expectObservable(getSut().info$()).toBe('a', { a: { AgriCorp: agri, TechCorp: tech } })
      })
    })

    test('should call getDivision once per division name', () => {
      jest.mocked(mockNs.corporation.getDivision).mockImplementation((name) => makeDivision({ name }))

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp', 'TechCorp'] }))
        getSut().info$().subscribe()
      })

      expect(mockNs.corporation.getDivision).toHaveBeenCalledWith('AgriCorp')
      expect(mockNs.corporation.getDivision).toHaveBeenCalledWith('TechCorp')
      expect(mockNs.corporation.getDivision).toHaveBeenCalledTimes(2)
    })

    test('should emit an empty record when there are no divisions', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: [] }))
        expectObservable(getSut().info$()).toBe('a', { a: {} })
      })
    })

    test('should re-emit a fresh record when divisionNames$ emits again', () => {
      const agri = makeDivision({ name: 'AgriCorp' })
      const tech = makeDivision({ name: 'TechCorp' })
      jest.mocked(mockNs.corporation.getDivision).mockReturnValueOnce(agri).mockReturnValueOnce(tech)

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a-b', { a: ['AgriCorp'], b: ['TechCorp'] }))
        expectObservable(getSut().info$()).toBe('a-b', {
          a: { AgriCorp: agri },
          b: { TechCorp: tech },
        })
      })
    })
  })

  describe('divisionCity$', () => {
    test('should emit a record mapping each division name to its cities', () => {
      const cities = ['Aevum', 'Sector-12'] as CityName[]
      jest.mocked(mockNs.corporation.getDivision).mockReturnValue(makeDivision({ name: 'AgriCorp', cities }))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().divisionCity$()).toBe('a', { a: { AgriCorp: cities } })
      })
    })

    test('should map multiple divisions to their respective cities', () => {
      const agriCities = ['Aevum'] as CityName[]
      const techCities = ['Sector-12', 'Chongqing'] as CityName[]
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockImplementation((name) =>
          name === 'AgriCorp'
            ? makeDivision({ name: 'AgriCorp', cities: agriCities })
            : makeDivision({ name: 'TechCorp', cities: techCities }),
        )

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp', 'TechCorp'] }))
        expectObservable(getSut().divisionCity$()).toBe('a', {
          a: { AgriCorp: agriCities, TechCorp: techCities },
        })
      })
    })
    test('should map a division with no cities to an empty array', () => {
      jest.mocked(mockNs.corporation.getDivision).mockReturnValue(makeDivision({ name: 'AgriCorp', cities: [] }))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().divisionCity$()).toBe('a', { a: { AgriCorp: [] } })
      })
    })
  })

  describe('eachDivisionNameAndCityName$', () => {
    test('should emit one pair per division×city combination', () => {
      const cities = ['Aevum', 'Sector-12'] as CityName[]
      jest.mocked(mockNs.corporation.getDivision).mockReturnValue(makeDivision({ name: 'AgriCorp', cities }))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().eachDivisionNameAndCityName$()).toBe('(ab)', {
          a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName },
          b: { divisionName: 'AgriCorp', cityName: 'Sector-12' as CityName },
        })
      })
    })

    test('should emit pairs for multiple divisions', () => {
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockImplementation((name) =>
          name === 'AgriCorp'
            ? makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[] })
            : makeDivision({ name: 'TechCorp', cities: ['Sector-12'] as CityName[] }),
        )

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp', 'TechCorp'] }))
        expectObservable(getSut().eachDivisionNameAndCityName$()).toBe('(ab)', {
          a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName },
          b: { divisionName: 'TechCorp', cityName: 'Sector-12' as CityName },
        })
      })
    })

    test('should emit nothing when there are no divisions', () => {
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: [] }))
        getSut().eachDivisionNameAndCityName$().subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })

    test('should emit nothing for a division with no cities', () => {
      jest.mocked(mockNs.corporation.getDivision).mockReturnValue(makeDivision({ name: 'AgriCorp', cities: [] }))
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        getSut().eachDivisionNameAndCityName$().subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })
  })

  describe('divisionCityProducts$', () => {
    test('should emit a record keyed by "divisionName|cityName" mapping to products', () => {
      const product = { name: 'Product A' } as unknown as Product
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[], products: ['Product A'] }))
      jest.mocked(mockNs.corporation.getProduct).mockReturnValue(product)

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().divisionCityProducts$()).toBe('a', {
          a: { 'AgriCorp|Aevum': [product] },
        })
      })
    })

    test('should call getProduct for each product in each division×city', () => {
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(
          makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[], products: ['Product A', 'Product B'] }),
        )
      jest.mocked(mockNs.corporation.getProduct).mockReturnValue({} as Product)

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        getSut().divisionCityProducts$().subscribe()
      })

      expect(mockNs.corporation.getProduct).toHaveBeenCalledWith('AgriCorp', 'Aevum', 'Product A')
      expect(mockNs.corporation.getProduct).toHaveBeenCalledWith('AgriCorp', 'Aevum', 'Product B')
      expect(mockNs.corporation.getProduct).toHaveBeenCalledTimes(2)
    })

    test('should emit an empty products array for a division×city with no products', () => {
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[], products: [] }))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().divisionCityProducts$()).toBe('a', { a: { 'AgriCorp|Aevum': [] } })
      })
    })

    test('should accumulate separate entries for each city in a division', () => {
      const product = { name: 'Product A' } as unknown as Product
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(
          makeDivision({ name: 'AgriCorp', cities: ['Aevum', 'Sector-12'] as CityName[], products: ['Product A'] }),
        )
      jest.mocked(mockNs.corporation.getProduct).mockReturnValue(product)

      const emissions: Record<string, Product[]>[] = []

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        getSut().divisionCityProducts$().subscribe((v) => emissions.push(v))
      })

      expect(emissions.at(-1)).toEqual({
        'AgriCorp|Aevum': [product],
        'AgriCorp|Sector-12': [product],
      })
    })
  })

  describe('divisionCityMaterials$', () => {
    test('should emit a record keyed by "divisionName|cityName" mapping to materials', () => {
      const water = { name: 'Water' } as unknown as Material
      const food = { name: 'Food' } as unknown as Material
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[] }))
      jest
        .mocked(mockNs.corporation.getMaterial)
        .mockImplementation((_, __, materialName) => (materialName === 'Water' ? water : food))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().divisionCityMaterials$()).toBe('a', {
          a: { 'AgriCorp|Aevum': [water, food] },
        })
      })
    })

    test('should call getMaterial for each material name in each division×city', () => {
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[] }))
      jest.mocked(mockNs.corporation.getMaterial).mockReturnValue({} as Material)

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        getSut().divisionCityMaterials$().subscribe()
      })

      expect(mockNs.corporation.getMaterial).toHaveBeenCalledWith('AgriCorp', 'Aevum', 'Water')
      expect(mockNs.corporation.getMaterial).toHaveBeenCalledWith('AgriCorp', 'Aevum', 'Food')
      expect(mockNs.corporation.getMaterial).toHaveBeenCalledTimes(2)
    })

    test('should accumulate separate entries for each city in a division', () => {
      const water = { name: 'Water' } as unknown as Material
      const food = { name: 'Food' } as unknown as Material
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(makeDivision({ name: 'AgriCorp', cities: ['Aevum', 'Sector-12'] as CityName[] }))
      jest
        .mocked(mockNs.corporation.getMaterial)
        .mockImplementation((_, __, materialName) => (materialName === 'Water' ? water : food))

      const emissions: Record<string, Material[]>[] = []

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        getSut().divisionCityMaterials$().subscribe((v) => emissions.push(v))
      })

      expect(emissions.at(-1)).toEqual({
        'AgriCorp|Aevum': [water, food],
        'AgriCorp|Sector-12': [water, food],
      })
    })
  })

  describe('divisionFor$', () => {
    test('should emit the division matching the given name', () => {
      const div = makeDivision({ name: 'AgriCorp' })
      jest.mocked(mockNs.corporation.getDivision).mockReturnValue(div)

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().divisionFor$('AgriCorp')).toBe('(a|)', { a: div })
      })
    })

    test('should emit only the matching division when multiple divisions exist', () => {
      const agri = makeDivision({ name: 'AgriCorp' })
      const tech = makeDivision({ name: 'TechCorp' })
      jest.mocked(mockNs.corporation.getDivision).mockImplementation((name) => (name === 'AgriCorp' ? agri : tech))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp', 'TechCorp'] }))
        expectObservable(getSut().divisionFor$('TechCorp')).toBe('(a|)', { a: tech })
      })
    })

    test('should never emit when the named division does not exist', () => {
      jest.mocked(mockNs.corporation.getDivision).mockReturnValue(makeDivision({ name: 'AgriCorp' }))
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        getSut().divisionFor$('NonExistent').subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })
  })

  describe('divisionCityProductsFor$', () => {
    test('should emit the products for the given division×city', () => {
      const product = { name: 'Product A' } as unknown as Product
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[], products: ['Product A'] }))
      jest.mocked(mockNs.corporation.getProduct).mockReturnValue(product)

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().divisionCityProductsFor$('AgriCorp', 'Aevum' as CityName)).toBe('(a|)', {
          a: [product],
        })
      })
    })

    test('should not emit when the division×city combination has no entry in the map', () => {
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[], products: [] }))
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        getSut()
          .divisionCityProductsFor$('AgriCorp', 'Sector-12' as CityName)
          .subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })
  })

  describe('divisionCityMaterialsFor$', () => {
    test('should emit the materials for the given division×city', () => {
      const water = { name: 'Water' } as unknown as Material
      const food = { name: 'Food' } as unknown as Material
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[] }))
      jest
        .mocked(mockNs.corporation.getMaterial)
        .mockImplementation((_, __, materialName) => (materialName === 'Water' ? water : food))

      testScheduler.run(({ cold, expectObservable }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        expectObservable(getSut().divisionCityMaterialsFor$('AgriCorp', 'Aevum' as CityName)).toBe('(a|)', {
          a: [water, food],
        })
      })
    })

    test('should not emit when the division×city combination has no entry in the map', () => {
      jest
        .mocked(mockNs.corporation.getDivision)
        .mockReturnValue(makeDivision({ name: 'AgriCorp', cities: ['Aevum'] as CityName[] }))
      jest.mocked(mockNs.corporation.getMaterial).mockReturnValue({} as Material)
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        corporationMock.divisionNames$.mockReturnValue(cold('a', { a: ['AgriCorp'] }))
        getSut()
          .divisionCityMaterialsFor$('AgriCorp', 'Sector-12' as CityName)
          .subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })
  })
})
