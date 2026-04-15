import type { CityName, Division, Material, Product } from '@ns'
import { Observable, Subject } from 'rxjs'

export type DivisionsMock = {
  info$: jest.MockedFunction<() => Observable<Record<string, Division>>>
  eachDivisionNameAndCityName$: jest.MockedFunction<() => Observable<{ divisionName: string; cityName: CityName }>>
  divisionFor$: jest.MockedFunction<(divisionName: string) => Observable<Division>>
  divisionCityProductsFor$: jest.MockedFunction<(divisionName: string, cityName: string) => Observable<Product[]>>
  divisionCityMaterialsFor$: jest.MockedFunction<(divisionName: string, cityName: string) => Observable<Material[]>>
  /** Controllable subject — push pairs here in tests. */
  _subject: Subject<{ divisionName: string; cityName: CityName }>
}

/**
 * Creates a mock instance of {@link Divisions} with jest-mocked methods.
 * `eachDivisionNameAndCityName$` is backed by a controllable {@link Subject}.
 *
 * @returns A {@link DivisionsMock} instance ready for use in tests.
 */
export function createDivisionsMock(): DivisionsMock {
  const subject = new Subject<{ divisionName: string; cityName: CityName }>()
  return {
    info$: jest.fn<Observable<Record<string, Division>>, []>(),
    eachDivisionNameAndCityName$: jest
      .fn<Observable<{ divisionName: string; cityName: CityName }>, []>()
      .mockReturnValue(subject.asObservable()),
    divisionFor$: jest.fn<Observable<Division>, [string]>(),
    divisionCityProductsFor$: jest.fn<Observable<Product[]>, [string, string]>(),
    divisionCityMaterialsFor$: jest.fn<Observable<Material[]>, [string, string]>(),
    _subject: subject,
  }
}

export const Divisions = jest.fn().mockImplementation(createDivisionsMock)
