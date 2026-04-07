import 'reflect-metadata'

import { CorporationInfo, CorpResearchName, CorpStateName, CorpUpgradeName } from '@ns'
import { inject, injectable } from 'inversify'
import { from, map, mergeMap, Observable, of, reduce, shareReplay, single, switchMap, tap } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { delimited } from './delimited'
import { StateManager } from './state-manager'

/**
 * Reactive wrapper around the Bitburner corporation API.
 *
 * All observables are keyed off {@link StateManager.state$}, so they re-fetch
 * automatically on each corporation state transition. Results are
 * `shareReplay(1)`-cached so multiple subscribers don't trigger redundant API
 * calls within the same tick.
 */
@injectable('Singleton')
export class Corporation {
  /** Latest snapshot of the player's corporation. Re-fetches on every state tick. */
  readonly _info$: Observable<CorporationInfo> = this.stateManager.state$().pipe(
    // fetch a fresh corporation snapshot on each state transition
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

  /** Names of all divisions currently owned by the corporation. */
  readonly _divisionNames$: Observable<string[]> = this.info$().pipe(
    map((info) => info.divisions),
    shareReplay(1),
  )

  /**
   * Current upgrade level for every {@link CorpUpgradeName}.
   * Re-fetched on each state tick by iterating all upgrade names from the game constants.
   */
  readonly _upgradeLevels$: Observable<Record<CorpUpgradeName, number>> = this.stateManager.state$().pipe(
    // emit one upgradeName at a time from the full list
    switchMap(() => from(this.ns.corporation.getConstants().upgradeNames)),
    // accumulate {upgradeName → level} into a single record
    reduce(
      (acc, upgradeName) => ({
        ...acc,
        [upgradeName]: this.ns.corporation.getUpgradeLevel(upgradeName),
      }),
      {} as Record<CorpUpgradeName, number>,
    ),
    shareReplay(1),
  )

  /**
   * Lookup map of which researches have been unlocked per division.
   * Keys use the `{divisionName}|{researchName}` delimited format produced by {@link delimited}.
   */
  readonly _hasResearched$: Observable<Record<string, boolean>> = this._divisionNames$.pipe(
    // flatten division names into individual emissions
    switchMap((divisionNames) => from(divisionNames)),
    // for each division, pair it with every research name and check if it's been researched
    mergeMap((divisionName) =>
      from(this.ns.corporation.getConstants().researchNames).pipe(
        map((researchName) => ({
          divisionName,
          researchName,
          hasResearch: this.ns.corporation.hasResearched(divisionName, researchName),
        })),
      ),
    ),
    // collect all pairs into a flat record keyed by "divisionName|researchName"
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

  /** @returns Observable of the latest {@link CorporationInfo} snapshot. */
  info$() {
    return this._info$
  }

  /** @returns Observable of the corporation's next state name. */
  nextState$() {
    return this._nextState$
  }

  /** @returns Observable of the corporation's previous state name. */
  previousState$() {
    return this._previousState$
  }

  /** @returns Observable of the list of division names owned by the corporation. */
  divisionNames$() {
    return this._divisionNames$
  }

  /** @returns Observable of a record mapping every upgrade name to its current level. */
  upgradeLevels$() {
    return this._upgradeLevels$
  }

  /** @returns Observable of the full `{divisionName}|{researchName}` → boolean research map. */
  hasResearched$() {
    return this._hasResearched$
  }

  /**
   * Look up the current level of a single corporation upgrade.
   *
   * @param upgradeName - The name of the upgrade to query.
   * @returns Observable that emits the upgrade's current level.
   */
  upgradeLevelFor$(upgradeName: CorpUpgradeName): Observable<number> {
    return this._upgradeLevels$.pipe(
      map((upgradeLevels) => upgradeLevels[upgradeName]),
      single(),
    )
  }

  /**
   * Check whether a specific research has been unlocked in a division.
   *
   * @param divisionName - The name of the division to check.
   * @param researchName - The name of the research to check.
   * @returns Observable that emits `true` if the research has been unlocked.
   */
  hasResearchedFor$(divisionName: string, researchName: CorpResearchName): Observable<boolean> {
    return this._hasResearched$.pipe(
      map((hasResearched) => hasResearched[delimited(divisionName, researchName)]),
      single(),
    )
  }

  /**
   * Check whether the corporation's previous state matches a given state name.
   *
   * @param stateName - The state name to compare against.
   * @returns Observable that emits `true` if the previous state equals `stateName`.
   */
  previousStateOf$(stateName: CorpStateName): Observable<boolean> {
    return this._previousState$.pipe(map((previousState) => previousState === stateName))
  }
}
