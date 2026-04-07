import { makeTestScheduler } from '__helpers__/test-scheduler'
import type { CorporationInfo, CorpResearchName, CorpStateName, CorpUpgradeName } from '@ns'
import { createNsMock } from '@ns-mock'
import { TestScheduler } from 'rxjs/testing'

import { createStateManagerMock } from './__mocks__/state-manager'
import { Corporation } from './corporation'
import type { StateManager } from './state-manager'

const UPGRADE_NAMES = ['Smart Factories', 'Smart Storage'] as CorpUpgradeName[]
const RESEARCH_NAMES = ['Hi-Tech R&D Laboratory', 'AutoBrew'] as CorpResearchName[]

function makeCorporationInfo(overrides: Partial<CorporationInfo> = {}): CorporationInfo {
  return {
    nextState: 'START' as CorpStateName,
    prevState: 'SALE' as CorpStateName,
    divisions: [],
    ...overrides,
  } as unknown as CorporationInfo
}

describe('Corporation', () => {
  let mockNs: ReturnType<typeof createNsMock>
  let stateManagerMock: ReturnType<typeof createStateManagerMock>

  let testScheduler: TestScheduler

  const getSut = () => new Corporation(mockNs, stateManagerMock as unknown as StateManager)

  beforeEach(() => {
    mockNs = createNsMock()
    stateManagerMock = createStateManagerMock(mockNs)
    testScheduler = makeTestScheduler()

    jest.mocked(mockNs.corporation.getCorporation).mockReturnValue(makeCorporationInfo())
    jest.mocked(mockNs.corporation.getConstants).mockReturnValue({
      upgradeNames: UPGRADE_NAMES,
      researchNames: RESEARCH_NAMES,
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

    test('should emit the getCorporation result when state$ emits', () => {
      const info = makeCorporationInfo({ nextState: 'PURCHASE' })
      jest.mocked(mockNs.corporation.getCorporation).mockReturnValue(info)

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().info$()).toBe('(a|)', { a: info })
      })
    })

    test('should re-emit each time state$ emits', () => {
      const info1 = makeCorporationInfo({ nextState: 'PURCHASE' })
      const info2 = makeCorporationInfo({ nextState: 'PRODUCTION' })
      jest.mocked(mockNs.corporation.getCorporation).mockReturnValueOnce(info1).mockReturnValueOnce(info2)

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('a-b', { a: 'START', b: 'PURCHASE' }))
        expectObservable(getSut().info$()).toBe('a-b', { a: info1, b: info2 })
      })
    })

    test('should call getCorporation once per state$ emission', () => {
      testScheduler.run(({ cold }) => {
        stateManagerMock.state$.mockReturnValue(
          cold<CorpStateName>('abc', { a: 'START', b: 'PURCHASE', c: 'PRODUCTION' }),
        )

        getSut().info$().subscribe()
      })

      expect(mockNs.corporation.getCorporation).toHaveBeenCalledTimes(3)
    })
  })

  describe('nextState$', () => {
    test('should emit nextState from CorporationInfo', () => {
      jest.mocked(mockNs.corporation.getCorporation).mockReturnValue(makeCorporationInfo({ nextState: 'PURCHASE' }))

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().nextState$()).toBe('(a|)', { a: 'PURCHASE' as CorpStateName })
      })
    })

    test('should re-emit when state$ emits again', () => {
      jest
        .mocked(mockNs.corporation.getCorporation)
        .mockReturnValueOnce(makeCorporationInfo({ nextState: 'PURCHASE' }))
        .mockReturnValueOnce(makeCorporationInfo({ nextState: 'PRODUCTION' }))

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('a-b|', { a: 'START', b: 'PURCHASE' }))
        expectObservable(getSut().nextState$()).toBe('a-b|', {
          a: 'PURCHASE' as CorpStateName,
          b: 'PRODUCTION' as CorpStateName,
        })
      })
    })
  })

  describe('previousState$', () => {
    test('should emit prevState from CorporationInfo', () => {
      jest.mocked(mockNs.corporation.getCorporation).mockReturnValue(makeCorporationInfo({ prevState: 'PRODUCTION' }))

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().previousState$()).toBe('(a|)', { a: 'PRODUCTION' as CorpStateName })
      })
    })

    test('should log each previous state via ns.print', () => {
      jest
        .mocked(mockNs.corporation.getCorporation)
        .mockReturnValueOnce(makeCorporationInfo({ prevState: 'PURCHASE' }))
        .mockReturnValueOnce(makeCorporationInfo({ prevState: 'PRODUCTION' }))

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('a-b|', { a: 'START', b: 'PURCHASE' }))
        expectObservable(getSut().previousState$()).toBe('a-b|', {
          a: 'PURCHASE' as CorpStateName,
          b: 'PRODUCTION' as CorpStateName,
        })
      })

      expect(mockNs.print).toHaveBeenCalledWith('Previous corporation state: PURCHASE')
      expect(mockNs.print).toHaveBeenCalledWith('Previous corporation state: PRODUCTION')
      expect(mockNs.print).toHaveBeenCalledTimes(2)
    })
  })

  describe('divisionNames$', () => {
    test('should emit the divisions array from CorporationInfo', () => {
      jest
        .mocked(mockNs.corporation.getCorporation)
        .mockReturnValue(makeCorporationInfo({ divisions: ['AgriCorp', 'TechCorp'] }))

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().divisionNames$()).toBe('(a|)', { a: ['AgriCorp', 'TechCorp'] })
      })
    })

    test('should re-emit when state$ emits again', () => {
      jest
        .mocked(mockNs.corporation.getCorporation)
        .mockReturnValueOnce(makeCorporationInfo({ divisions: ['AgriCorp'] }))
        .mockReturnValueOnce(makeCorporationInfo({ divisions: ['AgriCorp', 'TechCorp'] }))

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('a-b|', { a: 'START', b: 'PURCHASE' }))
        expectObservable(getSut().divisionNames$()).toBe('a-b|', {
          a: ['AgriCorp'],
          b: ['AgriCorp', 'TechCorp'],
        })
      })
    })
  })

  describe('upgradeLevels$', () => {
    test('should emit a record mapping each upgrade name to its level', () => {
      jest.mocked(mockNs.corporation.getUpgradeLevel).mockImplementation((name) => (name === 'Smart Factories' ? 3 : 1))

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().upgradeLevels$()).toBe('(a|)', {
          a: { 'Smart Factories': 3, 'Smart Storage': 1 },
        })
      })
    })
  })

  describe('hasResearched$', () => {
    test('should emit a record keyed by "division|research" with boolean values', () => {
      jest.mocked(mockNs.corporation.getCorporation).mockReturnValue(makeCorporationInfo({ divisions: ['AgriCorp'] }))
      jest
        .mocked(mockNs.corporation.hasResearched)
        .mockImplementation((_, research) => research === 'Hi-Tech R&D Laboratory')

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().hasResearched$()).toBe('(a|)', {
          a: {
            'AgriCorp|Hi-Tech R&D Laboratory': true,
            'AgriCorp|AutoBrew': false,
          },
        })
      })
    })
  })

  describe('upgradeLevelFor$', () => {
    test('should emit the level for the requested upgrade', () => {
      jest.mocked(mockNs.corporation.getUpgradeLevel).mockReturnValue(7)

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().upgradeLevelFor$('Smart Factories' as CorpUpgradeName)).toBe('(a|)', { a: 7 })
      })
    })
  })

  describe('hasResearchedFor$', () => {
    test('should emit true when the division has the research', () => {
      jest.mocked(mockNs.corporation.getCorporation).mockReturnValue(makeCorporationInfo({ divisions: ['AgriCorp'] }))
      jest.mocked(mockNs.corporation.hasResearched).mockReturnValue(true)

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().hasResearchedFor$('AgriCorp', 'Hi-Tech R&D Laboratory' as CorpResearchName)).toBe(
          '(a|)',
          { a: true },
        )
      })
    })

    test('should emit false when the division does not have the research', () => {
      jest.mocked(mockNs.corporation.getCorporation).mockReturnValue(makeCorporationInfo({ divisions: ['AgriCorp'] }))
      jest.mocked(mockNs.corporation.hasResearched).mockReturnValue(false)

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().hasResearchedFor$('AgriCorp', 'Hi-Tech R&D Laboratory' as CorpResearchName)).toBe(
          '(a|)',
          { a: false },
        )
      })
    })
  })

  describe('previousStateOf$', () => {
    test('should emit true when previous state matches the given state', () => {
      jest.mocked(mockNs.corporation.getCorporation).mockReturnValue(makeCorporationInfo({ prevState: 'PURCHASE' }))

      testScheduler.run(({ cold, expectObservable }) => {
        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>('(a|)', { a: 'START' }))
        expectObservable(getSut().previousStateOf$('PURCHASE')).toBe('(a|)', { a: true })
      })
    })

    test('should emit false when previous state does not match', () => {
      jest.mocked(mockNs.corporation.getCorporation).mockReturnValue(makeCorporationInfo({ prevState: 'PRODUCTION' }))
      testScheduler.run(({ cold, expectObservable }) => {
        const input = ' a'
        const result = 'a'

        stateManagerMock.state$.mockReturnValue(cold<CorpStateName>(input, { a: 'START' }))
        expectObservable(getSut().previousStateOf$('PURCHASE')).toBe(result, { a: false })
      })
    })
  })
})
