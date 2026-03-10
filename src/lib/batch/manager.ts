import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'
import 'reflect-metadata'
import { NSIdentifier } from '../ns.identifier'
import { ServerList } from '../utils/server-list'
import { BatchRunner } from './runner'
import { BatchRunnerFactory } from './runner.factory'
import { EventEmitter } from 'node:events'

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class BatchManager extends EventEmitter<{
  finished: []
}> {
  private readonly batchRunners = new Map<string, BatchRunner>()

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(ServerList)
    private readonly serverList: ServerList,

    @inject(BatchRunnerFactory)
    private readonly batchRunnerFactory: BatchRunnerFactory,
  ) {
    super()

    this.ns.print('INFO BatchManager Initialized')

    this.setupBatches()

    this.serverList.on('serverAdded', () => {
      this.ns.print('INFO New server added, checking if we can run batches on it...')
      this.setupBatches()
    })
  }

  private setupBatches() {
    const servers = this.serverList.getAll()

    const targetServer = 'foodnstuff'

    if (!this.batchRunners.has(targetServer)) {
      const batchRunner = this.batchRunnerFactory.create(targetServer, 100)
      batchRunner.start()

      this.batchRunners.set(targetServer, batchRunner)
    }

    // for (const server of servers) {
    //   if (this.validHackingLevel(server) && !this.batchRunners.has(server)) {
    //     const score = this.ns.getServerMaxMoney(server) / this.ns.getServerMinSecurityLevel(server)
    //
    //     if (score > 0) {
    //       const batchRunner = this.batchRunnerFactory.create(server, score * -1)
    //       batchRunner.start()
    //
    //       this.batchRunners.set(server, batchRunner)
    //     }
    //   }
    // }
  }

  private validHackingLevel(server: string) {
    let hackingLevel = this.ns.getHackingLevel()

    if (hackingLevel !== 1) {
      hackingLevel = hackingLevel / 2
    }

    return this.ns.getServerRequiredHackingLevel(server) <= hackingLevel
  }
}
