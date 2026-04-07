import 'reflect-metadata'

import { CorpStateName } from '@ns'
import { inject, injectable } from 'inversify'
import { defer, Observable, repeat, shareReplay } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'

/**
 * Singleton service that tracks the Bitburner corporation game loop.
 *
 * Wraps `ns.corporation.nextUpdate()` — which resolves once per in-game
 * corporation tick — in a shared, continuously-repeating observable so any
 * number of consumers can react to state transitions without each running
 * their own poll loop.
 *
 * Injected as a singleton so the single shared observable is the only source
 * of corporation-tick events for the entire zeus DI graph.
 */
@injectable('Singleton')
export class StateManager {
  private readonly _state$: Observable<CorpStateName> = defer(() => this._getState()).pipe(
    // re-subscribe immediately after each tick, paced by the game's own cadence
    repeat(),
    // multicast to all subscribers; replay the latest state to late joiners
    shareReplay(1),
  )

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    this.state$().subscribe({
      next: (state) => this.ns.print(`Corporation state: ${state}`),
    })
  }

  /** Hot observable that emits the new {@link CorpStateName} on every corporation tick. */
  state$() {
    return this._state$
  }

  /** Awaits the next corporation tick and returns its resulting state name. */
  private async _getState() {
    return this.ns.corporation.nextUpdate()
  }
}
