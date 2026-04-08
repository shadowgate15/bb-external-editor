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
import { BOOST_MATERIAL_FACTORS } from './boost-material'
import { Corporation } from './corporation'
import { delimited } from './delimited'

/**
 * Provides reactive access to corporation division data. All observables are derived from
 * `Corporation.divisionNames$` and share a single cached subscription via `shareReplay(1)`.
 */
@injectable('Singleton')
export class Divisions {
  /**
   * Shared observable of all divisions indexed by name. Re-emits a fresh record whenever
   * `corporation.divisionNames$` emits a new list.
   */
  readonly _info$: Observable<Record<string, Division>> = this.corporation.divisionNames$().pipe(
    // fetch full Division objects for each name and collect into a name-keyed record
    switchMap((divisionNames) =>
      from(divisionNames).pipe(
        map((divisionName) => this.ns.corporation.getDivision(divisionName)),
        reduce((acc, division) => ({ ...acc, [division.name]: division }), {}),
      ),
    ),
    shareReplay(1),
  )

  /**
   * Shared observable mapping each division name to the list of cities it operates in.
   * Derived from `_info$`.
   */
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

  /**
   * Shared observable that emits one `{ divisionName, cityName }` pair for every
   * division × city combination. Re-emits all pairs whenever `_divisionCity$` updates.
   */
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

  /**
   * Shared observable that accumulates a record of all products per division × city.
   * Keyed by `"{divisionName}|{cityName}"`. Entries are added as each pair is processed
   * and the record grows with each new emission via `scan`.
   */
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

  /**
   * Shared observable that accumulates a record of all materials per division × city.
   * Keyed by `"{divisionName}|{cityName}"`. Fetches every material from
   * `getConstants().materialNames` for each pair and grows via `scan`.
   */
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

  /** Returns an observable of all divisions indexed by name. Re-emits on every `divisionNames$` update. */
  info$() {
    return this._info$
  }

  /** Returns an observable mapping each division name to its list of active cities. */
  divisionCity$() {
    return this._divisionCity$
  }

  /**
   * Returns an observable that emits one `{ divisionName, cityName }` pair for every
   * active division × city combination.
   */
  eachDivisionNameAndCityName$() {
    return this._eachDivisionNameAndCityName$
  }

  /**
   * Returns an observable of all products across every division × city, keyed by
   * `"{divisionName}|{cityName}"`.
   */
  divisionCityProducts$() {
    return this._divisionCityProducts$
  }

  /**
   * Returns an observable of all materials across every division × city, keyed by
   * `"{divisionName}|{cityName}"`.
   */
  divisionCityMaterials$() {
    return this._divisionCityMaterials$
  }

  /**
   * Emits the `Division` object whose name matches `divisionName`, then completes.
   * Never emits if no division with that name exists.
   *
   * @param divisionName - The name of the division to look up.
   * @returns An observable that emits the matching division and completes.
   */
  divisionFor$(divisionName: string): Observable<Division> {
    return this._info$.pipe(
      mergeMap((divisions) =>
        from(Object.values(divisions)).pipe(filter((division) => division.name === divisionName)),
      ),
      first(),
    )
  }

  /**
   * Emits the product list for the given division × city once it is available in
   * `_divisionCityProducts$`, then completes. Waits if the entry has not yet been
   * populated.
   *
   * @param divisionName - The name of the division.
   * @param cityName - The city within the division.
   * @returns An observable that emits the product array and completes.
   */
  divisionCityProductsFor$(divisionName: string, cityName: CityName): Observable<Product[]> {
    return this._divisionCityProducts$.pipe(
      map((divisionCityProducts) => divisionCityProducts[delimited(divisionName, cityName)]),
      first((products) => products !== undefined),
    )
  }

  /**
   * Emits the material list for the given division × city once it is available in
   * `_divisionCityMaterials$`, then completes. Waits if the entry has not yet been
   * populated.
   *
   * @param divisionName - The name of the division.
   * @param cityName - The city within the division.
   * @returns An observable that emits the material array and completes.
   */
  divisionCityMaterialsFor$(divisionName: string, cityName: CityName): Observable<Material[]> {
    return this._divisionCityMaterials$.pipe(
      map((divisionCityMaterials) => divisionCityMaterials[delimited(divisionName, cityName)]),
      first((materials) => materials !== undefined),
    )
  }

  clearBoostMaterials() {
    this._divisionCity$
      .pipe(
        first(),
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
      .subscribe(({ divisionName, cityName }) => {
        this.corporation
          .nextState$()
          .pipe(first((state) => state === 'PURCHASE'))
          .subscribe(() => {
            for (const boostMaterial of Object.values(BOOST_MATERIAL_FACTORS)) {
              this.ns.corporation.buyMaterial(divisionName, cityName, boostMaterial, 0)
              this.ns.corporation.sellMaterial(divisionName, cityName, boostMaterial, 'MAX', '0')
            }

            this.corporation
              .previousState$()
              .pipe(first((state) => state === 'PURCHASE'))
              .subscribe(() => {
                for (const boostMaterial of Object.values(BOOST_MATERIAL_FACTORS)) {
                  this.ns.corporation.sellMaterial(divisionName, cityName, boostMaterial, '0', '0')
                }
              })
          })
      })
  }
}
