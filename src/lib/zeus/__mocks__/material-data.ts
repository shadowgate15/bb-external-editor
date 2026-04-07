import type { CorpMaterialConstantData, CorpMaterialName } from '@ns'
import { Observable } from 'rxjs'

export type MaterialDataMock = {
  data$: jest.MockedFunction<() => Observable<Record<CorpMaterialName, CorpMaterialConstantData>>>
}

/**
 * Creates a mock instance of {@link MaterialData} with a jest-mocked `data$` method.
 *
 * @returns A {@link MaterialDataMock} instance ready for use in tests.
 */
export function createMaterialDataMock(): MaterialDataMock {
  return {
    data$: jest.fn<Observable<Record<CorpMaterialName, CorpMaterialConstantData>>, []>(),
  }
}

export const MaterialData = jest.fn().mockImplementation(createMaterialDataMock)
