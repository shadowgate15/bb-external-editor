import type { CityName, Warehouse } from '@ns'
import { Observable } from 'rxjs'

export type WarehousesMock = {
  warehouseFor$: jest.MockedFunction<(divisionName: string, cityName: CityName | string) => Observable<Warehouse>>
}

/**
 * Creates a mock instance of {@link Warehouses} with a jest-mocked `warehouseFor$` method.
 *
 * @returns A {@link WarehousesMock} instance ready for use in tests.
 */
export function createWarehousesMock(): WarehousesMock {
  return {
    warehouseFor$: jest.fn<Observable<Warehouse>, [string, string]>(),
  }
}

export const Warehouses = jest.fn().mockImplementation(createWarehousesMock)
