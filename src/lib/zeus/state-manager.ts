import 'reflect-metadata'

import { CorpStateName } from '@ns'
import { inject, injectable } from 'inversify'
import { defer, Observable, repeat, shareReplay } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'

@injectable('Singleton')
export class StateManager {
  private readonly _state$: Observable<CorpStateName> = defer(() => this._getState()).pipe(repeat(), shareReplay(1))

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    this.state$().subscribe({
      next: (state) => this.ns.print(`Corporation state: ${state}`),
    })
  }

  state$() {
    return this._state$
  }

  private async _getState() {
    return this.ns.corporation.nextUpdate()
  }
}
