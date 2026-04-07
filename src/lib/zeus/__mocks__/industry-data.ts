import type { CorpIndustryData, CorpIndustryName } from '@ns'
import { Observable } from 'rxjs'

export type IndustryDataMock = {
  data$: jest.MockedFunction<() => Observable<Record<CorpIndustryName, CorpIndustryData>>>
}

/**
 * Creates a mock instance of {@link IndustryData} with a jest-mocked `data$` method.
 *
 * @returns An {@link IndustryDataMock} instance ready for use in tests.
 */
export function createIndustryDataMock(): IndustryDataMock {
  return {
    data$: jest.fn<Observable<Record<CorpIndustryName, CorpIndustryData>>, []>(),
  }
}

export const IndustryData = jest.fn().mockImplementation(createIndustryDataMock)
