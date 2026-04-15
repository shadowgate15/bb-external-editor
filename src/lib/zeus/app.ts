import 'reflect-metadata'

import { inject, injectable } from 'inversify'
import { ignoreElements } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { BoostMaterial } from './boost-material'
import { CorporationDaemonServer } from './daemon/server'
import { ExportManager } from './export-manager'
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

    @inject(ExportManager)
    private readonly exportManager: ExportManager,
  ) {
    this.ns.atExit(() => {
      this.server.close()
    }, crypto.randomUUID())
  }

  async run() {
    this.seller.start()
    this.smartSupply.start()
    this.boostMaterial.start()
    this.exportManager.start()

    return new Promise<void>((resolve, reject) => {
      this.stateManager.state$().pipe(ignoreElements()).subscribe({
        error: reject,
        complete: resolve,
      })
    })
  }
}
