import 'reflect-metadata'

import { inject, injectable } from 'inversify'
import { ignoreElements } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { BoostMaterial } from './boost-material'
import { CorporationDaemonServer } from './daemon/server'
import { Seller } from './seller'
import { SmartSupply } from './smart-supply'
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

    @inject(Seller)
    private readonly seller: Seller,

    @inject(SmartSupply)
    private readonly smartSupply: SmartSupply,

    @inject(BoostMaterial)
    private readonly boostMaterial: BoostMaterial,
  ) {
    this.ns.atExit(() => {
      this.server.close()
    }, crypto.randomUUID())
  }

  async run() {
    this.seller.start()
    this.smartSupply.start()
    this.boostMaterial.start()

    return new Promise<void>((resolve, reject) => {
      this.stateManager.state$().pipe(ignoreElements()).subscribe({
        error: reject,
        complete: resolve,
      })
    })
  }
}
