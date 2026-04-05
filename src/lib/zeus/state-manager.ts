import 'reflect-metadata'

import { CorpStateName } from '@ns'
import { inject, injectable } from 'inversify'
import { defer, Observable, repeat, share } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'

@injectable('Singleton')
export class StateManager {
  public readonly state$: Observable<CorpStateName> = defer(() => this._getState()).pipe(repeat(), share())

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    this.state$.subscribe({
      next: (state) => this.ns.print(`Corporation state: ${state}`),
    })
  }

  private async _getState() {
    return this.ns.corporation.nextUpdate()
  }
}
