import 'reflect-metadata'

import { Office } from '@ns'
import { inject, injectable } from 'inversify'
import { map, Observable, reduce, shareReplay, single } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { delimited } from './delimited'
import { Divisions } from './divisions'

@injectable('Singleton')
export class Offices {
  readonly info$: Observable<Record<string, Office>> = this.divisions.eachDivisionNameAndCityName$().pipe(
    map(({ divisionName, cityName }) => ({
      divisionName,
      cityName,
      office: this.ns.corporation.getOffice(divisionName, cityName),
    })),
    reduce((acc, { divisionName, cityName, office }) => ({ ...acc, [delimited(divisionName, cityName)]: office }), {}),
    shareReplay(1),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Divisions)
    private readonly divisions: Divisions,
  ) {}

  infoFor$(divisionName: string, cityName: string): Observable<Office> {
    return this.info$.pipe(
      map((offices) => offices[delimited(divisionName, cityName)]),
      single(),
    )
  }
}
