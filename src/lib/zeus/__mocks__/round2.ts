import type { Round2 } from '../rounds/2'

export type Round2Mock = {
  run: jest.MockedFunction<() => Promise<void>>
}

/**
 * Creates a mock instance of {@link Round2} with a jest-mocked `run` method.
 *
 * @returns A {@link Round2Mock} instance ready for use in tests.
 */
export function createRound2Mock(): Round2Mock {
  return {
    run: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  }
}

export const Round2 = jest.fn().mockImplementation(createRound2Mock)
