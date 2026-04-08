import 'reflect-metadata'

import { CityName } from '@ns'
import { inject, injectable } from 'inversify'
import {
  combineLatest,
  concat,
  distinct,
  filter,
  first,
  from,
  ignoreElements,
  last,
  map,
  mergeMap,
  Observable,
  of,
  reduce,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs'

import { NSIdentifier } from '@/lib/ns.identifier'

import { Corporation } from '../corporation'
import { delimited } from '../delimited'
import { Divisions } from '../divisions'
import { IndustryData } from '../industry-data'
import { MaterialData } from '../material-data'
import { Warehouses } from '../warehouses'
import { computePurchasePlan } from './compute-purchase-plan'
import { TotalRawProduction } from './total-raw-production'

/**
 * Manages the smart-supply buying loop for all division × city pairs.
 *
 * Two observables drive the loop:
 * - `smartSupply$` — fires after each PURCHASE state, triggering a `TotalRawProduction` snapshot.
 * - `_beforePurchase$` — fires before each PURCHASE state, computes per-material buy amounts and
 *   emits one record per material. Also detects and reports warehouse congestion.
 *
 * Call `start()` to subscribe both and begin calling `ns.corporation.buyMaterial`.
 */
@injectable('Singleton')
export class SmartSupplyV2 {
  readonly congestion = new Map<string, number>()

  /**
   * Fires after each PURCHASE state transition. Updates the internal `TotalRawProduction`
   * snapshot used by the next before-purchase cycle.
   *
   * Uses `distinct()` to ignore consecutive identical emissions and `switchMap` to always
   * take the latest snapshot.
   */
  readonly smartSupply$: Observable<Record<string, number>> = this.corporation.previousStateOf$('PURCHASE').pipe(
    // skip consecutive duplicates
    distinct(),
    // only proceed on the PURCHASE transition
    filter((value) => value),
    tap(() => this.ns.print('INFO Detected purchase, updating smart supply...')),
    switchMap(() => this.totalRawProduction.totalRawProduction$.pipe(first())),
    shareReplay(1),
  )

  /**
   * Fires before each PURCHASE state. For every division × city pair:
   * 1. Checks warehouse congestion (productionAmount == 0 for 5+ consecutive cycles → alert).
   * 2. Calls `computePurchasePlan` to determine how much of each input material to buy.
   * 3. Emits one record per material with `{ divisionName, cityName, materialName, amount }`.
   */
  readonly _beforePurchase$: Observable<{
    divisionName: string
    cityName: CityName
    materialName: string
    amount: number
  }> = this.corporation.nextState$().pipe(
    map((state) => state === 'PURCHASE'),
    distinct(),
    filter((value) => value),
    tap(() => this.ns.print('INFO Detected upcoming purchase, buying input materials...')),
    switchMap(() =>
      this.divisions.eachDivisionNameAndCityName$().pipe(
        mergeMap(({ divisionName, cityName }) =>
          combineLatest({
            division: this.divisions.divisionFor$(divisionName),
            cityName: of(cityName),
            totalRawProduction: this.totalRawProduction.totalRawProduction$.pipe(
              map((totalRawProduction) => totalRawProduction[delimited(divisionName, cityName)]),
              first((v) => v !== undefined),
            ),
          }).pipe(last()),
        ),
      ),
    ),
    /* Congestion detection */
    mergeMap(({ division, cityName, totalRawProduction }) =>
      concat(
        concat(
          // check productionAmount of all output materials
          this.divisions.divisionCityMaterialsFor$(division.name, cityName).pipe(
            mergeMap((materials) => from(materials)),
            map((material) => material.productionAmount),
          ),
          // check productionAmount of all products
          this.divisions.divisionCityProductsFor$(division.name, cityName).pipe(
            mergeMap((products) => from(products)),
            map((product) => product.productionAmount),
          ),
        ).pipe(
          reduce((acc, productionAmount) => acc + productionAmount, 0),
          tap((totalProductionAmount) => {
            const key = delimited(division.name, cityName)

            if (totalProductionAmount === 0) {
              this.congestion.set(key, (this.congestion.get(key) ?? 0) + 1)
            } else {
              this.congestion.delete(key)
            }
          }),
          tap(() => {
            const key = delimited(division.name, cityName)

            if ((this.congestion.get(key) ?? 0) >= 5) {
              this.ns.toast(`WARNING ${division.name} in ${cityName} is congested!`, 'error')
            }
          }),
          ignoreElements(),
        ),
        of({ division, cityName, totalRawProduction }),
      ),
    ),
    /* Compute purchase plan */
    mergeMap(({ division, cityName, totalRawProduction }) =>
      combineLatest({
        division: of(division),
        cityName: of(cityName),
        totalRawProduction: of(totalRawProduction),
        requiredMaterials: this.industryData.data$().pipe(
          first(),
          map((industryData) => industryData[division.type].requiredMaterials),
        ),
        materialSizes: this.materialData.data$().pipe(first()),
        warehouseFreeSpace: this.warehouses
          .warehouseFor$(division.name, cityName)
          .pipe(map((warehouse) => warehouse.size - warehouse.sizeUsed)),
        inventory: this.divisions
          .divisionCityMaterialsFor$(division.name, cityName)
          .pipe(
            map((materials) =>
              materials.reduce(
                (acc, material) => ({ ...acc, [material.name]: material.stored }),
                {} as Record<string, number>,
              ),
            ),
          ),
      }).pipe(last()),
    ),
    map(
      ({
        division,
        cityName,
        totalRawProduction,
        requiredMaterials,
        materialSizes,
        warehouseFreeSpace,
        inventory,
      }) => ({
        division,
        cityName,
        purchasePlan: computePurchasePlan({
          totalRawProduction,
          requiredMaterials,
          materialSizes,
          warehouseFreeSpace,
          inventory,
        }),
      }),
    ),
    mergeMap(({ division, cityName, purchasePlan }) =>
      from(Object.entries(purchasePlan)).pipe(
        map(([materialName, amount]) => ({
          divisionName: division.name,
          cityName,
          materialName,
          amount,
        })),
      ),
    ),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Corporation)
    private readonly corporation: Corporation,

    @inject(Divisions)
    private readonly divisions: Divisions,

    @inject(TotalRawProduction)
    private readonly totalRawProduction: TotalRawProduction,

    @inject(IndustryData)
    private readonly industryData: IndustryData,

    @inject(MaterialData)
    private readonly materialData: MaterialData,

    @inject(Warehouses)
    private readonly warehouses: Warehouses,
  ) {}

  start() {
    this.smartSupply$.subscribe({
      next: () => this.ns.print('INFO Smart Supply updated supply requirements based on current production.'),
      complete: () => this.ns.print('INFO Smart Supply completed updating supply requirements.'),
    })

    this._beforePurchase$.subscribe({
      next: ({ divisionName, cityName, materialName, amount }) => {
        this.ns.corporation.buyMaterial(divisionName, cityName, materialName, amount)
      },
      complete: () => this.ns.print('INFO Completed buying input materials for smart supply.'),
    })
  }
}
