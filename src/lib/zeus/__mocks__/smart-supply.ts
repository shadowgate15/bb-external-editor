export type SmartSupplyMock = {
  start: jest.MockedFunction<() => void>
}

/**
 * Creates a mock instance of {@link SmartSupply} with a jest-mocked `start` method.
 *
 * @returns A {@link SmartSupplyMock} instance ready for use in tests.
 */
export function createSmartSupplyMock(): SmartSupplyMock {
  return {
    start: jest.fn<void, []>(),
  }
}

export const SmartSupply = jest.fn().mockImplementation(createSmartSupplyMock)
