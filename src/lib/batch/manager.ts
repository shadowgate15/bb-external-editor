import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'
import { lastValueFrom, Subject } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { ServerList } from '../utils/server-list'
import { type BatchRunnerFactory, RunnerFactory } from './runner'
import { BatchRunner } from './runner/runner'

@injectable('Singleton')
@provide()
export class BatchManager extends Subject<void> {
  private batchRunner: BatchRunner | null = null

  private score: number = 0

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(ServerList)
    private readonly serverList: ServerList,

    @inject(RunnerFactory)
    private readonly batchRunnerFactory: BatchRunnerFactory,
  ) {
    super()

    this.ns.print('INFO BatchManager Initialized')

    this.serverList.on('serverAdded', () => {
      this.setupBatches()
    })

    this.serverList.on('servers', () => {
      this.setupBatches()
    })

    this.setupBatches()
  }

  start(): Promise<void> {
    return lastValueFrom(this)
  }

  private async setupBatches() {
    const servers = this.serverList
      .getAll()
      .filter((server) => this.validHackingLevel(server) && this.ns.hasRootAccess(server))
      .map((server) => {
        const score = this.ns.getServerMaxMoney(server) / this.ns.getServerMinSecurityLevel(server)

        return [server, score] as const
      })
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])

    const [server, score] = servers.shift()

    if (score > this.score) {
      this.score = score

      // Kill current batch runner if it exists
      this.batchRunner?.stop()

      this.batchRunner = await this.batchRunnerFactory(server, score)
      this.batchRunner.start()
    }
  }

  private validHackingLevel(server: string) {
    let hackingLevel = this.ns.getHackingLevel()

    if (hackingLevel !== 1) {
      hackingLevel = hackingLevel / 2
    }

    return this.ns.getServerRequiredHackingLevel(server) <= hackingLevel
  }
}
