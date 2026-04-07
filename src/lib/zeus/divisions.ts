import 'reflect-metadata'

import { CityName, Division, Material, Product } from '@ns'
import { inject, injectable } from 'inversify'
import {
  filter,
  first,
  from,
  map,
  mergeMap,
  Observable,
  reduce,
  scan,
  shareReplay,
  single,
  switchMap,
  toArray,
} from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { Corporation } from './corporation'
import { delimited } from './delimited'

@injectable('Singleton')
export class Divisions {
  readonly _info$: Observable<Record<string, Division>> = this.corporation.divisionNames$().pipe(
    switchMap((divisionNames) =>
      from(divisionNames).pipe(
        map((divisionName) => this.ns.corporation.getDivision(divisionName)),
        reduce((acc, division) => ({ ...acc, [division.name]: division }), {}),
      ),
    ),
    shareReplay(1),
  )

  /** key: division name, value: city names */
  readonly _divisionCity$: Observable<Record<string, CityName[]>> = this._info$.pipe(
    map((divisions) =>
      Object.values(divisions).reduce(
        (acc, division) => ({
          ...acc,
          [division.name]: division.cities,
        }),
        {} as Record<string, CityName[]>,
      ),
    ),
    shareReplay(1),
  )

  readonly _eachDivisionNameAndCityName$: Observable<{ divisionName: string; cityName: CityName }> =
    this._divisionCity$.pipe(
      switchMap((divisionCity) =>
        from(Object.entries(divisionCity)).pipe(
          mergeMap(([divisionName, cityNames]) =>
            from(cityNames).pipe(
              map((cityName) => ({
                divisionName,
                cityName,
              })),
            ),
          ),
        ),
      ),
    )

  /** key: {division name}-{city name}, value: products */
  readonly _divisionCityProducts$: Observable<Record<string, Product[]>> = this._eachDivisionNameAndCityName$.pipe(
    mergeMap(({ divisionName, cityName }) =>
      this.divisionFor$(divisionName).pipe(
        mergeMap((division) =>
          from(division.products).pipe(
            map((productName) => this.ns.corporation.getProduct(division.name, cityName, productName)),
            toArray(),
            map((products) => ({
              divisionName,
              cityName,
              products,
            })),
          ),
        ),
      ),
    ),
    scan(
      (acc, { divisionName, cityName, products }) => ({ ...acc, [delimited(divisionName, cityName)]: products }),
      {} as Record<string, Product[]>,
    ),
    shareReplay(1),
  )

  /** key: {division name}-{city name}, value: materials */
  readonly _divisionCityMaterials$: Observable<Record<string, Material[]>> = this._eachDivisionNameAndCityName$.pipe(
    mergeMap(({ divisionName, cityName }) =>
      from(this.ns.corporation.getConstants().materialNames).pipe(
        map((materialName) => this.ns.corporation.getMaterial(divisionName, cityName, materialName)),
        toArray(),
        single(),
        map((materials) => ({
          divisionName,
          cityName,
          materials,
        })),
      ),
    ),
    scan(
      (acc, { divisionName, cityName, materials }) => ({ ...acc, [delimited(divisionName, cityName)]: materials }),
      {},
    ),
    shareReplay(1),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Corporation)
    private readonly corporation: Corporation,
  ) {}

  info$() {
    return this._info$
  }

  divisionCity$() {
    return this._divisionCity$
  }

  eachDivisionNameAndCityName$() {
    return this._eachDivisionNameAndCityName$
  }

  divisionCityProducts$() {
    return this._divisionCityProducts$
  }

  divisionCityMaterials$() {
    return this._divisionCityMaterials$
  }

  divisionFor$(divisionName: string): Observable<Division> {
    return this._info$.pipe(
      mergeMap((divisions) =>
        from(Object.values(divisions)).pipe(filter((division) => division.name === divisionName)),
      ),
      first(),
    )
  }

  divisionCityProductsFor$(divisionName: string, cityName: CityName): Observable<Product[]> {
    return this._divisionCityProducts$.pipe(
      map((divisionCityProducts) => divisionCityProducts[delimited(divisionName, cityName)]),
      first((products) => products !== undefined),
    )
  }

  divisionCityMaterialsFor$(divisionName: string, cityName: CityName): Observable<Material[]> {
    return this._divisionCityMaterials$.pipe(
      map((divisionCityMaterials) => divisionCityMaterials[delimited(divisionName, cityName)]),
      first((materials) => materials !== undefined),
    )
  }
}
