import type { Observable } from 'rxjs'

export type BoostMaterialMock = {
  start: jest.MockedFunction<() => void>
  fillBoostMaterials$: Observable<void>
}

/**
 * Creates a mock instance of {@link BoostMaterial} with jest-mocked methods.
 *
 * @returns A {@link BoostMaterialMock} instance ready for use in tests.
 */
export function createBoostMaterialMock(): BoostMaterialMock {
  return {
    start: jest.fn<void, []>(),
    fillBoostMaterials$: undefined as unknown as Observable<void>,
  }
}

export const BoostMaterial = jest.fn().mockImplementation(createBoostMaterialMock)
