import 'reflect-metadata'

import { Warehouse } from '@ns'
import { inject, injectable } from 'inversify'
import { map, Observable, reduce, shareReplay, single } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { delimited } from './delimited'
import { Divisions } from './divisions'

@injectable('Singleton')
export class Warehouses {
  readonly info$: Observable<Record<string, Warehouse>> = this.divisions.eachDivisionNameAndCityName$.pipe(
    map(({ divisionName, cityName }) => ({
      divisionName,
      cityName,
      warehouse: this.ns.corporation.getWarehouse(divisionName, cityName),
    })),
    reduce(
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

  warehouseFor$(divisionName: string, cityName: string): Observable<Warehouse> {
    return this.info$.pipe(
      map((warehouses) => warehouses[delimited(divisionName, cityName)]),
      single(),
    )
  }
}
