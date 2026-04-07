import { makeTestScheduler } from '__helpers__/test-scheduler'
import type { CityName, Warehouse } from '@ns'
import { createNsMock } from '@ns-mock'
import { TestScheduler } from 'rxjs/testing'

import { createDivisionsMock, DivisionsMock } from './__mocks__/divisions'
import type { Divisions } from './divisions'
import { Warehouses } from './warehouses'

function makeWarehouse(overrides: Partial<Warehouse> = {}): Warehouse {
  return {
    city: 'Aevum' as CityName,
    level: 1,
    size: 100,
    sizeUsed: 0,
    smartSupplyEnabled: false,
    ...overrides,
  }
}

describe('Warehouses', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let divisionsMock: DivisionsMock
  let testScheduler: TestScheduler

  const getSut = () => new Warehouses(mockNs, divisionsMock as unknown as Divisions)

  beforeEach(() => {
    mockNs = createNsMock()
    divisionsMock = createDivisionsMock()
    testScheduler = makeTestScheduler()
  })

  test('should be defined', () => {
    expect(getSut()).toBeDefined()
  })

  describe('info$', () => {
    test('should return the same observable instance on every call', () => {
      const sut = getSut()
      expect(sut.info$()).toBe(sut.info$())
    })

    test('should emit a record keyed by "divisionName|cityName" for a single pair', () => {
      const warehouse = makeWarehouse({ city: 'Aevum' as CityName })
      jest.mocked(mockNs.corporation.getWarehouse).mockReturnValue(warehouse)

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        expectObservable(getSut().info$()).toBe('a', { a: { 'AgriCorp|Aevum': warehouse } })
      })
    })

    test('should accumulate entries as additional pairs arrive', () => {
      const warehouseAevum = makeWarehouse({ city: 'Aevum' as CityName })
      const warehouseSector = makeWarehouse({ city: 'Sector-12' as CityName })
      jest
        .mocked(mockNs.corporation.getWarehouse)
        .mockImplementation((_, city) => (city === 'Aevum' ? warehouseAevum : warehouseSector))

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('ab', {
            a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName },
            b: { divisionName: 'AgriCorp', cityName: 'Sector-12' as CityName },
          }),
        )
        expectObservable(getSut().info$()).toBe('ab', {
          a: { 'AgriCorp|Aevum': warehouseAevum },
          b: { 'AgriCorp|Aevum': warehouseAevum, 'AgriCorp|Sector-12': warehouseSector },
        })
      })
    })

    test('should call getWarehouse with the correct divisionName and cityName', () => {
      jest.mocked(mockNs.corporation.getWarehouse).mockReturnValue(makeWarehouse())

      testScheduler.run(({ cold }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        getSut().info$().subscribe()
      })

      expect(mockNs.corporation.getWarehouse).toHaveBeenCalledWith('AgriCorp', 'Aevum')
      expect(mockNs.corporation.getWarehouse).toHaveBeenCalledTimes(1)
    })

    test('should emit nothing when no pairs arrive', () => {
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(cold(''))
        getSut()
          .info$()
          .subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })
  })

  describe('warehouseFor$', () => {
    test('should emit the warehouse for the given division×city and complete', () => {
      const warehouse = makeWarehouse({ city: 'Aevum' as CityName })
      jest.mocked(mockNs.corporation.getWarehouse).mockReturnValue(warehouse)

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        expectObservable(getSut().warehouseFor$('AgriCorp', 'Aevum')).toBe('(a|)', { a: warehouse })
      })
    })

    test('should emit only the warehouse for the requested division×city when multiple are present', () => {
      const warehouseAevum = makeWarehouse({ city: 'Aevum' as CityName })
      const warehouseSector = makeWarehouse({ city: 'Sector-12' as CityName })
      jest
        .mocked(mockNs.corporation.getWarehouse)
        .mockImplementation((_, city) => (city === 'Aevum' ? warehouseAevum : warehouseSector))

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('ab', {
            a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName },
            b: { divisionName: 'AgriCorp', cityName: 'Sector-12' as CityName },
          }),
        )
        expectObservable(getSut().warehouseFor$('AgriCorp', 'Sector-12')).toBe('-(a|)', { a: warehouseSector })
      })
    })

    test('should not emit when the division×city key has no entry in the map', () => {
      jest.mocked(mockNs.corporation.getWarehouse).mockReturnValue(makeWarehouse())
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        getSut()
          .warehouseFor$('AgriCorp', 'Sector-12')
          .subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })
  })
})
