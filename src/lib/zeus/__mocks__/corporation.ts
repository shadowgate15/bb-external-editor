import type { CorporationInfo, CorpResearchName, CorpStateName, CorpUpgradeName } from '@ns'
import { Observable, Subject } from 'rxjs'

export type CorporationMock = {
  info$: jest.MockedFunction<() => Observable<CorporationInfo>>
  nextState$: jest.MockedFunction<() => Observable<CorpStateName>>
  previousState$: jest.MockedFunction<() => Observable<CorpStateName>>
  divisionNames$: jest.MockedFunction<() => Observable<string[]>>
  upgradeLevels$: jest.MockedFunction<() => Observable<Record<CorpUpgradeName, number>>>
  hasResearched$: jest.MockedFunction<() => Observable<Record<string, boolean>>>
  upgradeLevelFor$: jest.MockedFunction<(upgradeName: CorpUpgradeName) => Observable<number>>
  hasResearchedFor$: jest.MockedFunction<(divisionName: string, researchName: CorpResearchName) => Observable<boolean>>
  previousStateOf$: jest.MockedFunction<(stateName: CorpStateName) => Observable<boolean>>
  /** Controllable subjects for the zero-arg observable methods. Push values here in tests. */
  subjects: {
    info: Subject<CorporationInfo>
    nextState: Subject<CorpStateName>
    previousState: Subject<CorpStateName>
    divisionNames: Subject<string[]>
    upgradeLevels: Subject<Record<CorpUpgradeName, number>>
    hasResearched: Subject<Record<string, boolean>>
  }
}

/**
 * Returns a default {@link CorporationInfo} object with sensible defaults.
 *
 * @param overrides - Partial overrides to apply on top of the defaults.
 * @returns A fully-populated `CorporationInfo` object.
 */
export function createCorporationInfoMock(overrides: Partial<CorporationInfo> = {}): CorporationInfo {
  return {
    name: 'MockCorp',
    funds: 0,
    revenue: 0,
    expenses: 0,
    public: false,
    totalShares: 1_000_000,
    numShares: 1_000_000,
    shareSaleCooldown: 0,
    investorShares: 0,
    issuedShares: 0,
    issueNewSharesCooldown: 0,
    sharePrice: 0,
    dividendRate: 0,
    dividendTax: 0,
    dividendEarnings: 0,
    nextState: 'START',
    prevState: 'START',
    divisions: [],
    valuation: 0,
    ...overrides,
  }
}

/**
 * Creates a mock instance of {@link Corporation} with jest-mocked methods backed by controllable
 * {@link Subject}s.
 *
 * @returns A {@link CorporationMock} instance ready for use in tests.
 */
export function createCorporationMock(): CorporationMock {
  const subjects: CorporationMock['subjects'] = {
    info: new Subject<CorporationInfo>(),
    nextState: new Subject<CorpStateName>(),
    previousState: new Subject<CorpStateName>(),
    divisionNames: new Subject<string[]>(),
    upgradeLevels: new Subject<Record<CorpUpgradeName, number>>(),
    hasResearched: new Subject<Record<string, boolean>>(),
  }

  return {
    info$: jest.fn<Observable<CorporationInfo>, []>().mockReturnValue(subjects.info.asObservable()),
    nextState$: jest.fn<Observable<CorpStateName>, []>().mockReturnValue(subjects.nextState.asObservable()),
    previousState$: jest
      .fn<Observable<CorpStateName>, []>()
      .mockReturnValue(subjects.previousState.asObservable()),
    divisionNames$: jest.fn<Observable<string[]>, []>().mockReturnValue(subjects.divisionNames.asObservable()),
    upgradeLevels$: jest
      .fn<Observable<Record<CorpUpgradeName, number>>, []>()
      .mockReturnValue(subjects.upgradeLevels.asObservable()),
    hasResearched$: jest
      .fn<Observable<Record<string, boolean>>, []>()
      .mockReturnValue(subjects.hasResearched.asObservable()),
    upgradeLevelFor$: jest.fn<Observable<number>, [CorpUpgradeName]>(),
    hasResearchedFor$: jest.fn<Observable<boolean>, [string, CorpResearchName]>(),
    previousStateOf$: jest.fn<Observable<boolean>, [CorpStateName]>(),
    subjects,
  }
}

export const Corporation = jest.fn().mockImplementation(createCorporationMock)
