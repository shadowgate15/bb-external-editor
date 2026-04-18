import { makeTestScheduler } from '__helpers__/test-scheduler'
import type { CityName, CorpStateName, Office } from '@ns'
import { createNsMock } from '@ns-mock'
import { of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'

import { ConfigMock, createConfigMock } from './__mocks__/config'
import { CorporationMock, createCorporationMock } from './__mocks__/corporation'
import { createDivisionsMock, DivisionsMock } from './__mocks__/divisions'
import { createOfficesMock, OfficesMock } from './__mocks__/offices'
import type { Config } from './config'
import type { Corporation } from './corporation'
import type { Divisions } from './divisions'
import { computeOptimalPartyCost, EnergyMoraleOptimizer } from './energy-morale-optimizer'
import type { Offices } from './offices'

// --- Fixture helpers ---

function makeOffice(overrides: Partial<Office> = {}): Office {
  return {
    city: 'Aevum' as CityName,
    size: 20,
    maxEnergy: 100,
    maxMorale: 100,
    numEmployees: 9,
    avgEnergy: 100,
    avgMorale: 100,
    totalExperience: 900,
    employeeProductionByJob: {
      Operations: 0,
      Engineer: 0,
      Business: 0,
      Management: 0,
      'Research & Development': 0,
      Intern: 0,
      Unassigned: 0,
    },
    employeeJobs: {
      Operations: 2,
      Engineer: 2,
      Business: 2,
      Management: 2,
      'Research & Development': 1,
      Intern: 0,
      Unassigned: 0,
    },
    ...overrides,
  }
}

function makeConfigData(overrides: Partial<Parameters<typeof makeConfigData>[0]> = {}) {
  return {
    enableBoostMaterials: false,
    enableOptimizeJobs: false,
    enableEnergyMoraleOptimizer: true,
    jobProductionWeights: { operations: 1, engineer: 1, business: 0.5, management: 0.5, research: 1 },
    moraleStepSize: 10,
    ...overrides,
  }
}

// --- Shared fixtures ---

const CITY = 'Aevum' as CityName
const DIVISION_NAME = 'AgriCorp'

// --- Suite: computeOptimalPartyCost ---

describe('computeOptimalPartyCost', () => {
  test('round-trips: applying the formula with the computed cost yields the target morale', () => {
    const currentMorale = 70
    const targetMorale = 80
    const perfMult = 1

    const x = computeOptimalPartyCost(currentMorale, targetMorale, perfMult)
    const newMorale = (currentMorale * perfMult + x / 1e6) * (1 + x / 1e7)

    expect(newMorale).toBeCloseTo(targetMorale, 4)
  })

  test('round-trips for a larger morale gap (50 → 100)', () => {
    const currentMorale = 50
    const targetMorale = 100
    const x = computeOptimalPartyCost(currentMorale, targetMorale)
    const newMorale = (currentMorale + x / 1e6) * (1 + x / 1e7)
    expect(newMorale).toBeCloseTo(targetMorale, 4)
  })

  test('round-trips with a non-default perfMult', () => {
    const currentMorale = 90
    const targetMorale = 95
    const perfMult = 0.999
    const x = computeOptimalPartyCost(currentMorale, targetMorale, perfMult)
    const newMorale = (currentMorale * perfMult + x / 1e6) * (1 + x / 1e7)
    expect(newMorale).toBeCloseTo(targetMorale, 4)
  })

  test('returns 0 when currentMorale is already at targetMorale', () => {
    expect(computeOptimalPartyCost(100, 100)).toBe(0)
  })

  test('returns 0 when currentMorale exceeds targetMorale', () => {
    expect(computeOptimalPartyCost(105, 100)).toBe(0)
  })

  test('returns a positive cost when morale is below target', () => {
    const cost = computeOptimalPartyCost(70, 80)
    expect(cost).toBeGreaterThan(0)
  })

  test('small incremental parties cost less in total than one large party for the same total gain', () => {
    // Compare: 3 small parties (70→80, 80→90, 90→100) vs 1 big party (70→100)
    const bigParty = computeOptimalPartyCost(70, 100)

    const step1 = computeOptimalPartyCost(70, 80)
    const step2 = computeOptimalPartyCost(80, 90)
    const step3 = computeOptimalPartyCost(90, 100)
    const totalSmall = step1 + step2 + step3

    expect(totalSmall).toBeLessThan(bigParty)
  })
})

// --- Suite: EnergyMoraleOptimizer service ---

describe('EnergyMoraleOptimizer', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let configMock: ConfigMock
  let divisionsMock: DivisionsMock
  let officesMock: OfficesMock
  let testScheduler: TestScheduler

  const getSut = () =>
    new EnergyMoraleOptimizer(
      mockNs,
      corporationMock as unknown as Corporation,
      configMock as unknown as Config,
      divisionsMock as unknown as Divisions,
      officesMock as unknown as Offices,
    )

  beforeEach(() => {
    mockNs = createNsMock()
    corporationMock = createCorporationMock()
    configMock = createConfigMock()
    divisionsMock = createDivisionsMock()
    officesMock = createOfficesMock()
    testScheduler = makeTestScheduler()
  })

  describe('optimizeEnergyMorale$', () => {
    test('does not emit when enableEnergyMoraleOptimizer is false', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData({ enableEnergyMoraleOptimizer: false }) }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))

        expectObservable(getSut().optimizeEnergyMorale$).toBe('')
      })
    })

    test('does not emit when nextState$ is not START', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData() }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'PURCHASE' as CorpStateName }))

        expectObservable(getSut().optimizeEnergyMorale$).toBe('')
      })
    })

    test('skips office when numEmployees is below decay threshold (< 9)', () => {
      const office = makeOffice({ numEmployees: 8, avgEnergy: 80, avgMorale: 70 })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData() }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeEnergyMorale$.subscribe()
      })

      expect(mockNs.corporation.buyTea).not.toHaveBeenCalled()
      expect(mockNs.corporation.throwParty).not.toHaveBeenCalled()
    })

    test('calls buyTea when avgEnergy is below maxEnergy', () => {
      const office = makeOffice({ numEmployees: 9, avgEnergy: 95, maxEnergy: 100, avgMorale: 100, maxMorale: 100 })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData() }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeEnergyMorale$.subscribe()
      })

      expect(mockNs.corporation.buyTea).toHaveBeenCalledWith(DIVISION_NAME, CITY)
    })

    test('does not call buyTea when avgEnergy equals maxEnergy', () => {
      const office = makeOffice({ numEmployees: 9, avgEnergy: 100, maxEnergy: 100, avgMorale: 100, maxMorale: 100 })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData() }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeEnergyMorale$.subscribe()
      })

      expect(mockNs.corporation.buyTea).not.toHaveBeenCalled()
    })

    test('calls throwParty with a positive cost when avgMorale is below maxMorale', () => {
      const office = makeOffice({ numEmployees: 9, avgEnergy: 100, maxEnergy: 100, avgMorale: 70, maxMorale: 100 })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData({ moraleStepSize: 10 }) }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeEnergyMorale$.subscribe()
      })

      expect(mockNs.corporation.throwParty).toHaveBeenCalledWith(DIVISION_NAME, CITY, expect.any(Number))

      const [, , cost] = jest.mocked(mockNs.corporation.throwParty).mock.calls[0]
      expect(cost).toBeGreaterThan(0)
    })

    test('throwParty cost targets morale step-capped at moraleStepSize, not a single jump to max', () => {
      const currentMorale = 70
      const maxMorale = 100
      const moraleStepSize = 10
      const office = makeOffice({
        numEmployees: 9,
        avgEnergy: 100,
        maxEnergy: 100,
        avgMorale: currentMorale,
        maxMorale,
      })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData({ moraleStepSize }) }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeEnergyMorale$.subscribe()
      })

      const expectedCost = computeOptimalPartyCost(currentMorale, currentMorale + moraleStepSize)
      const [, , cost] = jest.mocked(mockNs.corporation.throwParty).mock.calls[0]
      expect(cost).toBeCloseTo(expectedCost, 4)
    })

    test('throwParty target is capped at maxMorale when remaining gap < moraleStepSize', () => {
      const currentMorale = 95
      const maxMorale = 100
      const moraleStepSize = 10
      const office = makeOffice({
        numEmployees: 9,
        avgEnergy: 100,
        maxEnergy: 100,
        avgMorale: currentMorale,
        maxMorale,
      })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData({ moraleStepSize }) }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeEnergyMorale$.subscribe()
      })

      // Target should be min(95 + 10, 100) = 100, not 105
      const expectedCost = computeOptimalPartyCost(currentMorale, maxMorale)
      const [, , cost] = jest.mocked(mockNs.corporation.throwParty).mock.calls[0]
      expect(cost).toBeCloseTo(expectedCost, 4)
    })

    test('does not call throwParty when avgMorale equals maxMorale', () => {
      const office = makeOffice({ numEmployees: 9, avgEnergy: 100, maxEnergy: 100, avgMorale: 100, maxMorale: 100 })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData() }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeEnergyMorale$.subscribe()
      })

      expect(mockNs.corporation.throwParty).not.toHaveBeenCalled()
    })

    test('calls both buyTea and throwParty when both energy and morale are below max', () => {
      const office = makeOffice({ numEmployees: 9, avgEnergy: 80, maxEnergy: 100, avgMorale: 70, maxMorale: 100 })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData() }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeEnergyMorale$.subscribe()
      })

      expect(mockNs.corporation.buyTea).toHaveBeenCalledWith(DIVISION_NAME, CITY)
      expect(mockNs.corporation.throwParty).toHaveBeenCalledWith(DIVISION_NAME, CITY, expect.any(Number))
    })

    test('processes office correctly at exactly the decay threshold (numEmployees = 9)', () => {
      const office = makeOffice({ numEmployees: 9, avgEnergy: 90, maxEnergy: 100, avgMorale: 100, maxMorale: 100 })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(cold('a', { a: makeConfigData() }))
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeEnergyMorale$.subscribe()
      })

      expect(mockNs.corporation.buyTea).toHaveBeenCalledWith(DIVISION_NAME, CITY)
    })
  })
})
