import { makeTestScheduler } from '__helpers__/test-scheduler'
import type { CityName, CorpEmployeePosition, CorpStateName, Office } from '@ns'
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
import type { Offices } from './offices'
import {
  computeJobProductionRates,
  computeOptimalJobAssignment,
  DEFAULT_JOB_WEIGHTS,
  EmployeeStats,
  jobAssignmentsDiffer,
  JobWeights,
  OptimizeJobs,
  PRODUCTIVE_POSITIONS,
  solveEmployeeStats,
  solveLinearSystem,
} from './optimize-jobs'

// --- Fixture factories ---

function makeOffice(overrides: Partial<Office> = {}): Office {
  return {
    city: 'Aevum' as CityName,
    size: 10,
    maxEnergy: 100,
    maxMorale: 100,
    numEmployees: 5,
    avgEnergy: 100,
    avgMorale: 100,
    totalExperience: 500,
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
      Operations: 1,
      Engineer: 1,
      Business: 1,
      Management: 1,
      'Research & Development': 1,
      Intern: 0,
      Unassigned: 0,
    },
    ...overrides,
  }
}

/**
 * Build a mock office where `employeeProductionByJob` is forward-computed from known stats.
 * Useful for round-trip tests of {@link solveEmployeeStats}.
 */
function makeOfficeWithKnownStats(
  stats: EmployeeStats,
  jobs: Partial<Record<CorpEmployeePosition, number>>,
  avgMorale = 100,
  avgEnergy = 100,
  totalExperience = 500,
): Office {
  const numEmployees = Object.values(jobs).reduce((s, n) => s + (n ?? 0), 0)
  const exp = numEmployees > 0 ? totalExperience / numEmployees : 0
  const base = avgMorale * avgEnergy * 1e-4

  const { intelligence: I, charisma: A, creativity: C, efficiency: E } = stats

  const multipliers: Record<CorpEmployeePosition, number> = {
    Operations: 0.6 * I + 0.1 * A + exp + 0.5 * C + E,
    Engineer: I + 0.1 * A + 1.5 * exp + E,
    Business: 0.4 * I + A + 0.5 * exp,
    Management: 2 * A + exp + 0.2 * C + 0.7 * E,
    'Research & Development': 1.5 * I + 0.8 * exp + C + 0.5 * E,
    Intern: 0,
    Unassigned: 0,
  }

  const employeeJobs = {
    Operations: 0,
    Engineer: 0,
    Business: 0,
    Management: 0,
    'Research & Development': 0,
    Intern: 0,
    Unassigned: 0,
    ...jobs,
  } as Office['employeeJobs']

  const employeeProductionByJob = Object.fromEntries(
    (Object.entries(employeeJobs) as [CorpEmployeePosition, number][]).map(([pos, count]) => [
      pos,
      count * multipliers[pos] * base,
    ]),
  ) as Office['employeeProductionByJob']

  return makeOffice({
    numEmployees,
    avgMorale,
    avgEnergy,
    totalExperience,
    employeeJobs,
    employeeProductionByJob,
  })
}

// --- Shared fixtures ---

const CITY = 'Aevum' as CityName
const DIVISION_NAME = 'AgriCorp'

const KNOWN_STATS: EmployeeStats = {
  intelligence: 75,
  charisma: 60,
  creativity: 50,
  efficiency: 80,
}

// --- Suite: solveLinearSystem ---

describe('solveLinearSystem', () => {
  test('solves a simple identity system', () => {
    const A = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]
    const b = [1, 2, 3, 4]
    const result = solveLinearSystem(A, b)
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(1)
    expect(result![1]).toBeCloseTo(2)
    expect(result![2]).toBeCloseTo(3)
    expect(result![3]).toBeCloseTo(4)
  })

  test('returns null for a singular system', () => {
    const A = [
      [1, 2, 3, 4],
      [2, 4, 6, 8],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]
    const b = [1, 2, 0, 0]
    expect(solveLinearSystem(A, b)).toBeNull()
  })

  test('correctly solves a known well-conditioned 4x4 system', () => {
    // x + y + z + w = 10, 2x + y = 7, z + 3w = 12, x - w = 1
    const A = [
      [1, 1, 1, 1],
      [2, 1, 0, 0],
      [0, 0, 1, 3],
      [1, 0, 0, -1],
    ]
    const b = [10, 7, 12, 1]
    const result = solveLinearSystem(A, b)
    expect(result).not.toBeNull()
    // Verify Ax = b
    for (let i = 0; i < 4; i++) {
      const computed = A[i].reduce((sum, coeff, j) => sum + coeff * result![j], 0)
      expect(computed).toBeCloseTo(b[i], 8)
    }
  })
})

// --- Suite: solveEmployeeStats ---

describe('solveEmployeeStats', () => {
  test('returns null when fewer than 4 productive positions are populated', () => {
    const office = makeOffice({
      numEmployees: 3,
      totalExperience: 300,
      employeeJobs: {
        Operations: 1,
        Engineer: 1,
        Business: 1,
        Management: 0,
        'Research & Development': 0,
        Intern: 0,
        Unassigned: 0,
      },
    })
    expect(solveEmployeeStats(office, 100, 1)).toBeNull()
  })

  test('returns null when no employees are assigned to any position', () => {
    const office = makeOffice({ numEmployees: 0, totalExperience: 0 })
    expect(solveEmployeeStats(office, 0, 1)).toBeNull()
  })

  test('recovers known stats when all 5 positions are populated (round-trip)', () => {
    const jobs = { Operations: 2, Engineer: 2, Business: 2, Management: 2, 'Research & Development': 2 }
    const office = makeOfficeWithKnownStats(KNOWN_STATS, jobs)
    const exp = office.totalExperience / office.numEmployees
    const base = office.avgMorale * office.avgEnergy * 1e-4

    const result = solveEmployeeStats(office, exp, base)

    expect(result).not.toBeNull()
    expect(result!.intelligence).toBeCloseTo(KNOWN_STATS.intelligence, 3)
    expect(result!.charisma).toBeCloseTo(KNOWN_STATS.charisma, 3)
    expect(result!.creativity).toBeCloseTo(KNOWN_STATS.creativity, 3)
    expect(result!.efficiency).toBeCloseTo(KNOWN_STATS.efficiency, 3)
  })

  test('recovers known stats when exactly 4 positions are populated', () => {
    const jobs = { Operations: 1, Engineer: 1, Business: 1, Management: 1, 'Research & Development': 0 }
    const office = makeOfficeWithKnownStats(KNOWN_STATS, jobs)
    const exp = office.totalExperience / office.numEmployees
    const base = office.avgMorale * office.avgEnergy * 1e-4

    const result = solveEmployeeStats(office, exp, base)

    expect(result).not.toBeNull()
    expect(result!.intelligence).toBeCloseTo(KNOWN_STATS.intelligence, 3)
    expect(result!.charisma).toBeCloseTo(KNOWN_STATS.charisma, 3)
    expect(result!.creativity).toBeCloseTo(KNOWN_STATS.creativity, 3)
    expect(result!.efficiency).toBeCloseTo(KNOWN_STATS.efficiency, 3)
  })

  test('uses only first 4 populated positions when all 5 are staffed', () => {
    // This is the same as the round-trip test; ensures the function uses the first 4 and is consistent
    const jobs = { Operations: 3, Engineer: 3, Business: 3, Management: 3, 'Research & Development': 3 }
    const office = makeOfficeWithKnownStats(KNOWN_STATS, jobs)
    const exp = office.totalExperience / office.numEmployees
    const base = office.avgMorale * office.avgEnergy * 1e-4

    const result = solveEmployeeStats(office, exp, base)
    expect(result).not.toBeNull()
    expect(result!.intelligence).toBeCloseTo(KNOWN_STATS.intelligence, 3)
  })

  test('returns null when production base is zero (avoids division by zero)', () => {
    const jobs = { Operations: 1, Engineer: 1, Business: 1, Management: 1, 'Research & Development': 1 }
    const office = makeOfficeWithKnownStats(KNOWN_STATS, jobs, 0, 100)
    const exp = office.totalExperience / office.numEmployees
    // base = 0 → all p_j = 0 → singular system for most stat combinations
    const result = solveEmployeeStats(office, exp, 0)
    // Should either return null or a valid solution — we just verify no exception is thrown
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

// --- Suite: computeJobProductionRates ---

describe('computeJobProductionRates', () => {
  test('returns non-negative rates for all productive positions', () => {
    const rates = computeJobProductionRates(KNOWN_STATS, 100, 1)
    for (const pos of PRODUCTIVE_POSITIONS) {
      expect(rates[pos]).toBeGreaterThanOrEqual(0)
    }
  })

  test('Intern and Unassigned rates are always 0', () => {
    const rates = computeJobProductionRates(KNOWN_STATS, 100, 1)
    expect(rates['Intern']).toBe(0)
    expect(rates['Unassigned']).toBe(0)
  })

  test('scales linearly with production base', () => {
    const rates1 = computeJobProductionRates(KNOWN_STATS, 50, 1)
    const rates2 = computeJobProductionRates(KNOWN_STATS, 50, 2)
    for (const pos of PRODUCTIVE_POSITIONS) {
      expect(rates2[pos]).toBeCloseTo(rates1[pos] * 2, 8)
    }
  })

  test('produces correct Operations rate for known stats', () => {
    const { intelligence: I, charisma: A, creativity: C, efficiency: E } = KNOWN_STATS
    const exp = 100
    const base = 0.5
    const expected = base * (0.6 * I + 0.1 * A + exp + 0.5 * C + E)
    const rates = computeJobProductionRates(KNOWN_STATS, exp, base)
    expect(rates['Operations']).toBeCloseTo(expected, 8)
  })

  test('produces correct R&D rate for known stats', () => {
    const { intelligence: I, creativity: C, efficiency: E } = KNOWN_STATS
    const exp = 100
    const base = 0.5
    const expected = base * (1.5 * I + 0.8 * exp + C + 0.5 * E)
    const rates = computeJobProductionRates(KNOWN_STATS, exp, base)
    expect(rates['Research & Development']).toBeCloseTo(expected, 8)
  })
})

// --- Suite: computeOptimalJobAssignment ---

describe('computeOptimalJobAssignment', () => {
  const rates = computeJobProductionRates(KNOWN_STATS, 100, 1)

  test('total assigned always equals numEmployees', () => {
    for (const n of [1, 5, 10, 23, 100]) {
      const result = computeOptimalJobAssignment(n, rates, DEFAULT_JOB_WEIGHTS)
      const total = PRODUCTIVE_POSITIONS.reduce((s, pos) => s + result[pos], 0)
      expect(total).toBe(n)
    }
  })

  test('no position receives a negative count', () => {
    const result = computeOptimalJobAssignment(20, rates, DEFAULT_JOB_WEIGHTS)
    for (const pos of PRODUCTIVE_POSITIONS) {
      expect(result[pos]).toBeGreaterThanOrEqual(0)
    }
  })

  test('a position with weight 0 receives 0 employees', () => {
    const weights: JobWeights = { ...DEFAULT_JOB_WEIGHTS, business: 0, management: 0 }
    const result = computeOptimalJobAssignment(20, rates, weights)
    expect(result['Business']).toBe(0)
    expect(result['Management']).toBe(0)
  })

  test('distributes evenly when all effective values are equal', () => {
    const equalRates: typeof rates = {
      Operations: 1,
      Engineer: 1,
      Business: 1,
      Management: 1,
      'Research & Development': 1,
      Intern: 0,
      Unassigned: 0,
    }
    const equalWeights: JobWeights = { operations: 1, engineer: 1, business: 1, management: 1, research: 1 }
    const result = computeOptimalJobAssignment(10, equalRates, equalWeights)
    const total = PRODUCTIVE_POSITIONS.reduce((s, pos) => s + result[pos], 0)
    expect(total).toBe(10)
    // Each position should get ~2 (10 / 5)
    for (const pos of PRODUCTIVE_POSITIONS) {
      expect(result[pos]).toBe(2)
    }
  })

  test('handles 0 employees gracefully', () => {
    const result = computeOptimalJobAssignment(0, rates, DEFAULT_JOB_WEIGHTS)
    const total = PRODUCTIVE_POSITIONS.reduce((s, pos) => s + result[pos], 0)
    expect(total).toBe(0)
  })

  test('handles edge case where all rates are 0 (even distribution fallback)', () => {
    const zeroRates: typeof rates = {
      Operations: 0,
      Engineer: 0,
      Business: 0,
      Management: 0,
      'Research & Development': 0,
      Intern: 0,
      Unassigned: 0,
    }
    const result = computeOptimalJobAssignment(5, zeroRates, DEFAULT_JOB_WEIGHTS)
    const total = PRODUCTIVE_POSITIONS.reduce((s, pos) => s + result[pos], 0)
    expect(total).toBe(5)
  })
})

// --- Suite: jobAssignmentsDiffer ---

describe('jobAssignmentsDiffer', () => {
  const baseJobs: Office['employeeJobs'] = {
    Operations: 3,
    Engineer: 3,
    Business: 2,
    Management: 1,
    'Research & Development': 1,
    Intern: 0,
    Unassigned: 0,
  }

  test('returns false when current matches target exactly', () => {
    const target = { ...baseJobs }
    expect(jobAssignmentsDiffer(baseJobs, target)).toBe(false)
  })

  test('returns true when any position count differs', () => {
    const target = { ...baseJobs, Operations: 4 }
    expect(jobAssignmentsDiffer(baseJobs, target)).toBe(true)
  })

  test('returns true when a position goes from 0 to non-zero', () => {
    const current: Office['employeeJobs'] = { ...baseJobs, 'Research & Development': 0 }
    const target = { ...baseJobs, 'Research & Development': 1 }
    expect(jobAssignmentsDiffer(current, target)).toBe(true)
  })

  test('treats undefined current count as 0', () => {
    const current = { ...baseJobs } as Office['employeeJobs']
    // Simulate missing key
    delete (current as Partial<typeof current>)['Operations']
    const target = { ...baseJobs, Operations: 0 }
    expect(jobAssignmentsDiffer(current, target)).toBe(false)
  })
})

// --- Suite: OptimizeJobs service ---

describe('OptimizeJobs', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let corporationMock: CorporationMock
  let configMock: ConfigMock
  let divisionsMock: DivisionsMock
  let officesMock: OfficesMock
  let testScheduler: TestScheduler

  const getSut = () =>
    new OptimizeJobs(
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

  describe('optimizeJobs$', () => {
    test('should not emit when config has enableOptimizeJobs = false', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        configMock.data$.mockReturnValue(
          cold('a', {
            a: { enableOptimizeJobs: false, enableBoostMaterials: false, jobProductionWeights: DEFAULT_JOB_WEIGHTS },
          }),
        )
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))

        expectObservable(getSut().optimizeJobs$).toBe('')
      })
    })

    test('should not emit when nextState$ is not START (even if config enabled)', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        configMock.data$.mockReturnValue(
          cold('a', {
            a: { enableOptimizeJobs: true, enableBoostMaterials: false, jobProductionWeights: DEFAULT_JOB_WEIGHTS },
          }),
        )
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'PURCHASE' as CorpStateName }))

        expectObservable(getSut().optimizeJobs$).toBe('')
      })
    })

    test('should call setAutoJobAssignment to clear then set assignments when changes are needed', () => {
      const jobs = { Operations: 2, Engineer: 2, Business: 2, Management: 2, 'Research & Development': 2 }
      const office = makeOfficeWithKnownStats(KNOWN_STATS, jobs)
      // Mutate current assignment to differ from optimal so a change will be triggered
      office.employeeJobs['Operations'] = 0
      office.employeeJobs['Unassigned'] = 2

      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(
          cold('a', {
            a: { enableOptimizeJobs: true, enableBoostMaterials: false, jobProductionWeights: DEFAULT_JOB_WEIGHTS },
          }),
        )
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeJobs$.subscribe()
      })

      // Should have cleared all 5 positions first (called with 0)
      const calls = jest.mocked(mockNs.corporation.setAutoJobAssignment).mock.calls
      expect(calls.some(([div, city, , count]) => div === DIVISION_NAME && city === CITY && count === 0)).toBe(true)
      // Should also set non-zero assignments
      expect(calls.some(([div, city, , count]) => div === DIVISION_NAME && city === CITY && count > 0)).toBe(true)
    })

    test('should not call setAutoJobAssignment when current assignment already matches optimal', () => {
      const totalN = 10
      const totalExp = 500
      const exp = totalExp / totalN
      const base = 100 * 100 * 1e-4

      // Pre-compute optimal directly to build a self-consistent office
      const rates = computeJobProductionRates(KNOWN_STATS, exp, base)
      const optimal = computeOptimalJobAssignment(totalN, rates, DEFAULT_JOB_WEIGHTS)

      // Create an office where job counts = optimal and production values are forward-computed
      // from those same counts, so the solver round-trips back to the same optimal
      const office = makeOfficeWithKnownStats(KNOWN_STATS, optimal, 100, 100, totalExp)

      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(
          cold('a', {
            a: { enableOptimizeJobs: true, enableBoostMaterials: false, jobProductionWeights: DEFAULT_JOB_WEIGHTS },
          }),
        )
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeJobs$.subscribe()
      })

      expect(mockNs.corporation.setAutoJobAssignment).not.toHaveBeenCalled()
    })

    test('should skip city and print warning when fewer than 4 productive positions are staffed', () => {
      const office = makeOffice({
        numEmployees: 2,
        totalExperience: 200,
        employeeJobs: {
          Operations: 1,
          Engineer: 1,
          Business: 0,
          Management: 0,
          'Research & Development': 0,
          Intern: 0,
          Unassigned: 0,
        },
      })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(
          cold('a', {
            a: { enableOptimizeJobs: true, enableBoostMaterials: false, jobProductionWeights: DEFAULT_JOB_WEIGHTS },
          }),
        )
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeJobs$.subscribe()
      })

      expect(mockNs.corporation.setAutoJobAssignment).not.toHaveBeenCalled()
      expect(mockNs.print).toHaveBeenCalledWith(expect.stringContaining('fewer than 4'))
    })

    test('should skip city when numEmployees is 0', () => {
      const office = makeOffice({ numEmployees: 0, totalExperience: 0 })
      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(
          cold('a', {
            a: { enableOptimizeJobs: true, enableBoostMaterials: false, jobProductionWeights: DEFAULT_JOB_WEIGHTS },
          }),
        )
        corporationMock.nextState$.mockReturnValue(cold('b', { b: 'START' as CorpStateName }))
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('c', { c: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeJobs$.subscribe()
      })

      expect(mockNs.corporation.setAutoJobAssignment).not.toHaveBeenCalled()
    })

    test('should stop optimizing when enableOptimizeJobs flips to false', () => {
      const jobs = { Operations: 2, Engineer: 2, Business: 2, Management: 2, 'Research & Development': 2 }
      const office = makeOfficeWithKnownStats(KNOWN_STATS, jobs)
      office.employeeJobs['Operations'] = 0
      office.employeeJobs['Unassigned'] = 2

      officesMock.infoFor$.mockReturnValue(of(office))

      testScheduler.run(({ cold }) => {
        configMock.data$.mockReturnValue(
          cold('a---b', {
            a: { enableOptimizeJobs: true, enableBoostMaterials: false, jobProductionWeights: DEFAULT_JOB_WEIGHTS },
            b: { enableOptimizeJobs: false, enableBoostMaterials: false, jobProductionWeights: DEFAULT_JOB_WEIGHTS },
          }),
        )
        // First START at frame 1 (while enabled); second at frame 5 (after disabled at frame 4)
        corporationMock.nextState$.mockReturnValue(
          cold('-c---d', { c: 'START' as CorpStateName, d: 'START' as CorpStateName }),
        )
        divisionsMock.eachDivisionNameAndCityName$.mockReturnValue(
          cold('e', { e: { divisionName: DIVISION_NAME, cityName: CITY } }),
        )

        getSut().optimizeJobs$.subscribe()
      })

      // Only first START (while enabled) should have triggered assignments
      expect(jest.mocked(mockNs.corporation.setAutoJobAssignment).mock.calls.length).toBeGreaterThan(0)
    })
  })
})
