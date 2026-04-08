import 'reflect-metadata'

import { inject, injectable } from 'inversify'
import { ignoreElements } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { CorporationDaemonServer } from './daemon/server'
import { Seller } from './seller'
import { SmartSupplyV2 } from './smart-supply-v2'
import { StateManager } from './state-manager'

@injectable('Singleton')
export class App {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(CorporationDaemonServer)
    private readonly server: CorporationDaemonServer,

    @inject(StateManager)
    private readonly stateManager: StateManager,

    @inject(SmartSupplyV2)
    private readonly smartSupply: SmartSupplyV2,

    @inject(Seller)
    private readonly seller: Seller,
  ) {
    this.ns.atExit(() => {
      this.server.close()
    }, crypto.randomUUID())
  }

  async run() {
    this.smartSupply.start()
    this.seller.start()

    return new Promise<void>((resolve, reject) => {
      this.stateManager.state$().pipe(ignoreElements()).subscribe({
        error: reject,
        complete: resolve,
      })
    })
  }
}
