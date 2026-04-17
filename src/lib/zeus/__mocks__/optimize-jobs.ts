import type { Observable } from 'rxjs'

export type OptimizeJobsMock = {
  start: jest.MockedFunction<() => void>
  optimizeJobs$: Observable<void>
}

/**
 * Creates a mock instance of {@link OptimizeJobs} with jest-mocked methods.
 *
 * @returns An {@link OptimizeJobsMock} instance ready for use in tests.
 */
export function createOptimizeJobsMock(): OptimizeJobsMock {
  return {
    start: jest.fn<void, []>(),
    optimizeJobs$: undefined as unknown as Observable<void>,
  }
}

export const OptimizeJobs = jest.fn().mockImplementation(createOptimizeJobsMock)
