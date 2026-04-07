import 'reflect-metadata'

import { CorporationInfo, CorpResearchName, CorpStateName, CorpUpgradeName } from '@ns'
import { inject, injectable } from 'inversify'
import { from, map, mergeMap, Observable, of, reduce, shareReplay, single, switchMap, tap } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { delimited } from './delimited'
import { StateManager } from './state-manager'

@injectable('Singleton')
export class Corporation {
  readonly _info$: Observable<CorporationInfo> = this.stateManager.state$().pipe(
    switchMap(() => of(this.ns.corporation.getCorporation())),
    shareReplay(1),
  )

  /** The next state the corporation will transition to */
  readonly _nextState$: Observable<CorpStateName> = this._info$.pipe(
    map((info) => info.nextState),
    shareReplay(1),
  )

  /** The previous state the corporation transitioned from */
  readonly _previousState$: Observable<CorpStateName> = this._info$.pipe(
    map((info) => info.prevState),
    tap((state) => this.ns.print(`Previous corporation state: ${state}`)),
    shareReplay(1),
  )

  readonly _divisionNames$: Observable<string[]> = this.info$().pipe(
    map((info) => info.divisions),
    shareReplay(1),
  )

  readonly _upgradeLevels$: Observable<Record<CorpUpgradeName, number>> = this.stateManager.state$().pipe(
    switchMap(() => from(this.ns.corporation.getConstants().upgradeNames)),
    reduce(
      (acc, upgradeName) => ({
        ...acc,
        [upgradeName]: this.ns.corporation.getUpgradeLevel(upgradeName),
      }),
      {} as Record<CorpUpgradeName, number>,
    ),
    shareReplay(1),
  )

  /** `{divisionName}|{researchName}` delimited key */
  readonly _hasResearched$: Observable<Record<string, boolean>> = this._divisionNames$.pipe(
    switchMap((divisionNames) => from(divisionNames)),
    mergeMap((divisionName) =>
      from(this.ns.corporation.getConstants().researchNames).pipe(
        map((researchName) => ({
          divisionName,
          researchName,
          hasResearch: this.ns.corporation.hasResearched(divisionName, researchName),
        })),
      ),
    ),
    reduce(
      (acc, { divisionName, researchName, hasResearch }) => ({
        ...acc,
        [delimited(divisionName, researchName)]: hasResearch,
      }),
      {} as Record<string, boolean>,
    ),
    shareReplay(1),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(StateManager)
    private readonly stateManager: StateManager,
  ) {}

  info$() {
    return this._info$
  }

  nextState$() {
    return this._nextState$
  }

  previousState$() {
    return this._previousState$
  }

  divisionNames$() {
    return this._divisionNames$
  }

  upgradeLevels$() {
    return this._upgradeLevels$
  }

  hasResearched$() {
    return this._hasResearched$
  }

  upgradeLevelFor$(upgradeName: CorpUpgradeName): Observable<number> {
    return this._upgradeLevels$.pipe(
      map((upgradeLevels) => upgradeLevels[upgradeName]),
      single(),
    )
  }

  hasResearchedFor$(divisionName: string, researchName: CorpResearchName): Observable<boolean> {
    return this._hasResearched$.pipe(
      map((hasResearched) => hasResearched[delimited(divisionName, researchName)]),
      single(),
    )
  }

  previousStateOf$(stateName: CorpStateName): Observable<boolean> {
    return this._previousState$.pipe(map((previousState) => previousState === stateName))
  }
}
