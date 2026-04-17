export type EnergyMoraleOptimizerMock = {
  start: jest.MockedFunction<() => void>
}

/**
 * Creates a mock instance of {@link EnergyMoraleOptimizer} with a jest-mocked `start` method.
 *
 * @returns An {@link EnergyMoraleOptimizerMock} instance ready for use in tests.
 */
export function createEnergyMoraleOptimizerMock(): EnergyMoraleOptimizerMock {
  return {
    start: jest.fn<void, []>(),
  }
}

export const EnergyMoraleOptimizer = jest.fn().mockImplementation(createEnergyMoraleOptimizerMock)
