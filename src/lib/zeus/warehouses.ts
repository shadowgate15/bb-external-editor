import 'reflect-metadata'

import { Warehouse } from '@ns'
import { inject, injectable } from 'inversify'
import { first, map, Observable, scan, shareReplay } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { delimited } from './delimited'
import { Divisions } from './divisions'

@injectable('Singleton')
export class Warehouses {
  readonly _info$: Observable<Record<string, Warehouse>> = this.divisions.eachDivisionNameAndCityName$().pipe(
    map(({ divisionName, cityName }) => ({
      divisionName,
      cityName,
      warehouse: this.ns.corporation.getWarehouse(divisionName, cityName),
    })),
    scan(
      (acc, { divisionName, cityName, warehouse }) => ({ ...acc, [delimited(divisionName, cityName)]: warehouse }),
      {},
    ),
    shareReplay(1),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Divisions)
    private readonly divisions: Divisions,
  ) {}

  info$() {
    return this._info$
  }

  warehouseFor$(divisionName: string, cityName: string): Observable<Warehouse> {
    return this._info$.pipe(
      map((warehouses) => warehouses[delimited(divisionName, cityName)]),
      first((warehouse) => warehouse !== undefined),
    )
  }
}
