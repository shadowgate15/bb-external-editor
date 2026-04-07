import 'reflect-metadata'

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
  single,
  switchMap,
  tap,
  toArray,
} from 'rxjs'

import { NSIdentifier } from '@/lib/ns.identifier'

import { Corporation } from '../corporation'
import { delimited } from '../delimited'
import { Divisions } from '../divisions'
import { IndustryData } from '../industry-data'
import { Warehouses } from '../warehouses'
import { TotalRawProduction } from './total-raw-production'

@injectable('Singleton')
export class SmartSupply {
  readonly smartSupply = new Map<string, number>()

  readonly congestion = new Map<string, number>()

  private readonly smartSupply$: Observable<Record<string, number>> = this.corporation
    .previousStateOf$('PURCHASE')
    .pipe(
      // skip consecutive duplicates (e.g. repeated non-PURCHASE ticks)
      distinct(),
      // only proceed on the PURCHASE transition
      filter((value) => value),
      tap(() => this.ns.print('INFO Detected purchase, updating smart supply...')),
      switchMap(() => this.totalRawProduction.totalRawProduction$.pipe(first())),
      shareReplay(1),
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

    @inject(Warehouses)
    private readonly warehouses: Warehouses,
  ) {}

  start() {
    this.smartSupply$.subscribe({
      next: () => this.ns.print('INFO Smart Supply updated supply requirements based on current production.'),
      complete: () => this.ns.print('INFO Smart Supply completed updating supply requirements.'),
    })

    this._beforePurchase()
  }

  private _beforePurchase() {
    this.corporation
      .nextState$()
      .pipe(
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
                  single(),
                ),
              }).pipe(last(), single()),
            ),
          ),
        ),
        /* Handle Congestion */
        mergeMap(({ division, cityName, totalRawProduction }) =>
          concat(
            concat(
              // check materials produced in this division/city
              this.divisions.divisionCityMaterialsFor$(division.name, cityName).pipe(
                mergeMap((materials) => from(materials)),
                map((material) => material.productionAmount),
              ),
              this.divisions.divisionCityProductsFor$(division.name, cityName).pipe(
                mergeMap((products) => from(products)),
                map((product) => product.productionAmount),
              ),
            ).pipe(
              reduce((acc, productionAmount) => acc + productionAmount, 0),
              tap((accumulatedProduced) => {
                const key = delimited(division.name, cityName)

                if (accumulatedProduced > 0) {
                  this.congestion.set(key, this.congestion.get(key) ?? 0 + 1)
                } else {
                  this.congestion.delete(key)
                }
              }),
              tap(() => {
                const key = delimited(division.name, cityName)

                if (this.congestion.has(key) && this.congestion.get(key)! >= 5) {
                  this.ns.toast(`WARNING ${division.name} in ${cityName} is congested!`, 'error')
                }
              }),
              ignoreElements(),
            ),
            of({ division, cityName, totalRawProduction }),
          ),
        ),
        /* Setup Buying of inputs */
        mergeMap(({ division, cityName, totalRawProduction }) => {
          const warehouseCapacity$ = this.warehouses
            .warehouseFor$(division.name, cityName)
            .pipe(map((warehouse) => warehouse.size))

          const inventory$ = this.divisions
            .divisionCityMaterialsFor$(division.name, cityName)
            .pipe(
              map((materials) =>
                materials.reduce(
                  (acc, material) => ({ ...acc, [material.name]: material.stored }),
                  {} as Record<string, number>,
                ),
              ),
            )

          const requiredMaterials$ = this.industryData.data$().pipe(
            first(),
            map((industryData) => industryData[division.type]),
            map((industry) => industry.requiredMaterials),
          )

          // Multiply TotalRawProduction by coefficients
          const required$ = requiredMaterials$.pipe(
            mergeMap((requiredMaterials) => from(Object.entries(requiredMaterials))),
            map(([materialName, amountPerUnit]) => ({ materialName, required: amountPerUnit * totalRawProduction })),
            toArray(),
            shareReplay(1),
          )

          // Find limiting material
          const bottleneck$ = required$.pipe(map((required) => Math.min(...required.map((r) => r.required))))

          // Align all materials to bottleneck
          const aligned$ = combineLatest({
            required: required$,
            bottleneck: bottleneck$,
          }).pipe(
            map(({ required, bottleneck }) =>
              required.map(({ materialName, required }) => ({
                materialName,
                required: required === 0 ? 0 : required * (bottleneck / required),
              })),
            ),
          )

          // Sum all aligned inputs
          const totalSize$ = aligned$.pipe(map((aligned) => aligned.reduce((sum, { required }) => sum + required, 0)))

          // Scale down if warehouse is too small
          const multiplier$ = combineLatest({
            totalSize: totalSize$,
            warehouseCapacity: warehouseCapacity$,
          }).pipe(
            map(({ totalSize, warehouseCapacity }) =>
              totalSize > warehouseCapacity ? warehouseCapacity / totalSize : 1,
            ),
          )

          // Scaled Requirements Stream
          const scaled$ = combineLatest({
            aligned: aligned$,
            multiplier: multiplier$,
          }).pipe(
            map(({ aligned, multiplier }) =>
              aligned.map(({ materialName, required }) => ({
                materialName,
                required: required * multiplier,
              })),
            ),
          )

          // Subtract Inventory
          const purchasePlan$ = combineLatest({
            scaled: scaled$,
            inventory: inventory$,
          }).pipe(
            map(({ scaled, inventory }) => {
              const result: Record<string, number> = {}

              for (const { materialName, required } of scaled) {
                const stored = inventory[materialName] ?? 0

                result[materialName] = Math.max(required - stored, 0)
              }

              return result
            }),
          )

          return combineLatest({
            division: of(division),
            cityName: of(cityName),
            purchasePlan: purchasePlan$,
          }).pipe(last(), single())
        }),
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
        tap(({ divisionName, cityName, materialName, amount }) => {
          this.ns.print(
            `INFO Planning to buy ${amount.toFixed(2)} of ${materialName} for ${divisionName} in ${cityName}...`,
          )
        }),
      )
      .subscribe({
        next: ({ divisionName, cityName, materialName, amount }) => {
          this.ns.corporation.buyMaterial(divisionName, cityName, materialName, amount)
        },
        complete: () => this.ns.print('INFO Completed buying input materials for smart supply.'),
      })
  }
}
