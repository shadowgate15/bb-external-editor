import type { CityName, Office } from '@ns'
import { Observable } from 'rxjs'

export type OfficesMock = {
  infoFor$: jest.MockedFunction<(divisionName: string, cityName: CityName | string) => Observable<Office>>
}

/**
 * Creates a mock instance of {@link Offices} with a jest-mocked `infoFor$` method.
 *
 * @returns An {@link OfficesMock} instance ready for use in tests.
 */
export function createOfficesMock(): OfficesMock {
  return {
    infoFor$: jest.fn<Observable<Office>, [string, string]>(),
  }
}

export const Offices = jest.fn().mockImplementation(createOfficesMock)
