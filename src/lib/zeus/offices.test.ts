import { makeTestScheduler } from '__helpers__/test-scheduler'
import type { CityName, Office } from '@ns'
import { createNsMock } from '@ns-mock'
import { TestScheduler } from 'rxjs/testing'

import { createDivisionsMock, DivisionsMock } from './__mocks__/divisions'
import type { Divisions } from './divisions'
import { Offices } from './offices'

function makeOffice(overrides: Partial<Office> = {}): Office {
  return {
    city: 'Aevum' as CityName,
    size: 3,
    maxEnergy: 100,
    maxMorale: 100,
    numEmployees: 0,
    avgEnergy: 100,
    avgMorale: 100,
    totalExperience: 0,
    employeeProductionByJob: {} as Office['employeeProductionByJob'],
    employeeJobs: {} as Office['employeeJobs'],
    ...overrides,
  }
}

describe('Offices', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let divisionsMock: DivisionsMock
  let testScheduler: TestScheduler

  const getSut = () => new Offices(mockNs, divisionsMock as unknown as Divisions)

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
      const office = makeOffice({ city: 'Aevum' as CityName })
      jest.mocked(mockNs.corporation.getOffice).mockReturnValue(office)

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        expectObservable(getSut().info$()).toBe('a', { a: { 'AgriCorp|Aevum': office } })
      })
    })

    test('should accumulate entries as additional pairs arrive', () => {
      const officeAevum = makeOffice({ city: 'Aevum' as CityName })
      const officeSector = makeOffice({ city: 'Sector-12' as CityName })
      jest
        .mocked(mockNs.corporation.getOffice)
        .mockImplementation((_, city) => (city === 'Aevum' ? officeAevum : officeSector))

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('ab', {
            a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName },
            b: { divisionName: 'AgriCorp', cityName: 'Sector-12' as CityName },
          }),
        )
        expectObservable(getSut().info$()).toBe('ab', {
          a: { 'AgriCorp|Aevum': officeAevum },
          b: { 'AgriCorp|Aevum': officeAevum, 'AgriCorp|Sector-12': officeSector },
        })
      })
    })

    test('should call getOffice with the correct divisionName and cityName', () => {
      jest.mocked(mockNs.corporation.getOffice).mockReturnValue(makeOffice())

      testScheduler.run(({ cold }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        getSut().info$().subscribe()
      })

      expect(mockNs.corporation.getOffice).toHaveBeenCalledWith('AgriCorp', 'Aevum')
      expect(mockNs.corporation.getOffice).toHaveBeenCalledTimes(1)
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

  describe('infoFor$', () => {
    test('should emit the office for the given division×city and complete', () => {
      const office = makeOffice({ city: 'Aevum' as CityName })
      jest.mocked(mockNs.corporation.getOffice).mockReturnValue(office)

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        expectObservable(getSut().infoFor$('AgriCorp', 'Aevum')).toBe('(a|)', { a: office })
      })
    })

    test('should emit only the office for the requested division×city when multiple are present', () => {
      const officeAevum = makeOffice({ city: 'Aevum' as CityName })
      const officeSector = makeOffice({ city: 'Sector-12' as CityName })
      jest
        .mocked(mockNs.corporation.getOffice)
        .mockImplementation((_, city) => (city === 'Aevum' ? officeAevum : officeSector))

      testScheduler.run(({ cold, expectObservable }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('ab', {
            a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName },
            b: { divisionName: 'AgriCorp', cityName: 'Sector-12' as CityName },
          }),
        )
        expectObservable(getSut().infoFor$('AgriCorp', 'Sector-12')).toBe('-(a|)', { a: officeSector })
      })
    })

    test('should not emit when the division×city key has no entry in the map', () => {
      jest.mocked(mockNs.corporation.getOffice).mockReturnValue(makeOffice())
      const emissions: unknown[] = []

      testScheduler.run(({ cold }) => {
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('a', { a: { divisionName: 'AgriCorp', cityName: 'Aevum' as CityName } }),
        )
        getSut()
          .infoFor$('AgriCorp', 'Sector-12')
          .subscribe((v) => emissions.push(v))
      })

      expect(emissions).toHaveLength(0)
    })
  })
})
