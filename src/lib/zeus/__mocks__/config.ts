import type { Observable } from 'rxjs'

import type { ConfigData } from '../config'

export type ConfigMock = {
  data$: jest.MockedFunction<() => Observable<ConfigData>>
  read: jest.MockedFunction<() => void>
}

/**
 * Creates a mock instance of {@link Config} with jest-mocked methods.
 *
 * @returns A {@link ConfigMock} instance ready for use in tests.
 */
export function createConfigMock(): ConfigMock {
  return {
    data$: jest.fn<Observable<ConfigData>, []>(),
    read: jest.fn<void, []>(),
  }
}

export const Config = jest.fn().mockImplementation(createConfigMock)
