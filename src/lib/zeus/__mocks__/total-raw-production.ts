import { Observable, Subject } from 'rxjs'

export type TotalRawProductionMock = {
  totalRawProduction$: Observable<Record<string, number>>
  /** Default controllable subject — reassign `totalRawProduction$` per-test with a cold observable when using TestScheduler. */
  _subject: Subject<Record<string, number>>
}

/**
 * Creates a mock instance of {@link TotalRawProduction} with a controllable `totalRawProduction$`.
 *
 * In marble tests, reassign `mock.totalRawProduction$` to a `cold()` observable before constructing the SUT:
 * ```ts
 * totalRawProductionMock.totalRawProduction$ = cold('a', { a: { 'Div|City': 42 } })
 * ```
 *
 * @returns A {@link TotalRawProductionMock} instance ready for use in tests.
 */
export function createTotalRawProductionMock(): TotalRawProductionMock {
  const subject = new Subject<Record<string, number>>()
  return {
    totalRawProduction$: subject.asObservable(),
    _subject: subject,
  }
}

export const TotalRawProduction = jest.fn().mockImplementation(createTotalRawProductionMock)
