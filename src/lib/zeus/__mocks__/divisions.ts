import type { CityName } from '@ns'
import { Observable, Subject } from 'rxjs'

export type DivisionsMock = {
  eachDivisionNameAndCityName$: jest.MockedFunction<
    () => Observable<{ divisionName: string; cityName: CityName }>
  >
  /** Controllable subject — push pairs here in tests. */
  _subject: Subject<{ divisionName: string; cityName: CityName }>
}

/**
 * Creates a mock instance of {@link Divisions} with a jest-mocked `eachDivisionNameAndCityName$`
 * method backed by a controllable {@link Subject}.
 *
 * @returns A {@link DivisionsMock} instance ready for use in tests.
 */
export function createDivisionsMock(): DivisionsMock {
  const subject = new Subject<{ divisionName: string; cityName: CityName }>()
  return {
    eachDivisionNameAndCityName$: jest
      .fn<Observable<{ divisionName: string; cityName: CityName }>, []>()
      .mockReturnValue(subject.asObservable()),
    _subject: subject,
  }
}

export const Divisions = jest.fn().mockImplementation(createDivisionsMock)
