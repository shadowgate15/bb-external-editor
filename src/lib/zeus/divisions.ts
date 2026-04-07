import 'reflect-metadata'

import { CityName, Division, Material, Product } from '@ns'
import { inject, injectable } from 'inversify'
import { filter, from, map, mergeMap, Observable, reduce, shareReplay, single, switchMap, toArray } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { Corporation } from './corporation'
import { delimited } from './delimited'

@injectable('Singleton')
export class Divisions {
  readonly info$: Observable<Record<string, Division>> = this.corporation.divisionNames$().pipe(
    switchMap((divisionNames) => from(divisionNames)),
    map((divisionName) => this.ns.corporation.getDivision(divisionName)),
    reduce((acc, division) => ({ ...acc, [division.name]: division }), {}),
    shareReplay(1),
  )

  /** key: division name, value: city names */
  readonly divisionCity$: Observable<Record<string, CityName[]>> = this.info$.pipe(
    switchMap((divisions) => from(Object.values(divisions))),
    reduce((acc, division) => ({ ...acc, [division.name]: division.cities }), {}),
    shareReplay(1),
  )

  readonly eachDivisionNameAndCityName$: Observable<{ divisionName: string; cityName: CityName }> =
    this.divisionCity$.pipe(
      switchMap((divisionCity) => from(Object.entries(divisionCity))),
      mergeMap(([divisionName, cityNames]) =>
        from(cityNames).pipe(
          map((cityName) => ({
            divisionName,
            cityName,
          })),
        ),
      ),
    )

  /** key: {division name}-{city name}, value: products */
  readonly divisionCityProducts$: Observable<Record<string, Product[]>> = this.eachDivisionNameAndCityName$.pipe(
    mergeMap(({ divisionName, cityName }) =>
      this.divisionFor$(divisionName).pipe(
        mergeMap((division) =>
          from(division.products).pipe(
            map((productName) => this.ns.corporation.getProduct(division.name, cityName, productName)),
            toArray(),
          ),
        ),
        single(),
        map((products) => ({
          divisionName,
          cityName,
          products,
        })),
      ),
    ),
    reduce(
      (acc, { divisionName, cityName, products }) => ({ ...acc, [delimited(divisionName, cityName)]: products }),
      {},
    ),
    shareReplay(1),
  )

  /** key: {division name}-{city name}, value: materials */
  readonly divisionCityMaterials$: Observable<Record<string, Material[]>> = this.eachDivisionNameAndCityName$.pipe(
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
    reduce(
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

  divisionFor$(divisionName: string): Observable<Division> {
    return this.info$.pipe(
      mergeMap((divisions) => from(Object.values(divisions))),
      filter((division) => division.name === divisionName),
      single(),
    )
  }

  divisionCityProductsFor$(divisionName: string, cityName: CityName): Observable<Product[]> {
    return this.divisionCityProducts$.pipe(
      map((divisionCityProducts) => divisionCityProducts[delimited(divisionName, cityName)]),
      single(),
    )
  }

  divisionCityMaterialsFor$(divisionName: string, cityName: CityName): Observable<Material[]> {
    return this.divisionCityMaterials$.pipe(
      map((divisionCityMaterials) => divisionCityMaterials[delimited(divisionName, cityName)]),
      single(),
    )
  }
}
