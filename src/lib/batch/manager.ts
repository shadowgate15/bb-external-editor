import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'
import { lastValueFrom, Subject } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { ServerList } from '../utils/server-list'
import { BatchConfig } from './config'
import { type BatchRunnerFactory, RunnerFactory } from './runner'
import { BatchRunner } from './runner/runner'

@injectable('Singleton')
@provide()
export class BatchManager extends Subject<void> {
  private batchRunner: BatchRunner | null = null

  private prepRunner: BatchRunner | null = null

  private prepScore: number = 0

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(ServerList)
    private readonly serverList: ServerList,

    @inject(RunnerFactory)
    private readonly batchRunnerFactory: BatchRunnerFactory,

    @inject(BatchConfig)
    private readonly config: BatchConfig,
  ) {
    super()

    this.ns.print('INFO BatchManager Initialized')

    this.setupBatches()

    this.serverList.on('serverAdded', () => {
      this.setupBatches()
    })

    this.serverList.on('servers', () => {
      this.setupBatches()
    })
  }

  start(): Promise<void> {
    return lastValueFrom(this)
  }

  private readonly setupBatches = async () => {
    // No need to do any of this if we can't start prepping a server
    if (this.prepRunner !== null) return

    const servers = this.serverList
      .getAll()
      .filter((server) => this.validHackingLevel(server) && this.ns.hasRootAccess(server))
      .map((server) => {
        const score = this.ns.getServerMaxMoney(server) / this.ns.getServerMinSecurityLevel(server)

        return [server, score] as const
      })
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])

    // Override with config server if it exists
    const configServer = servers.find(([server]) => server === this.config.server())

    if (configServer) {
      if (this.batchRunner?.target === configServer[0]) {
        return
      }

      const runner = await this.batchRunnerFactory(...configServer)

      this.prepRunner = runner

      runner.prep().then(() => {
        // Only replace batch runner after preperation is complete
        this.batchRunner?.stop()

        this.batchRunner = runner
        this.prepRunner = null

        return runner.start()
      })

      return
    }

    const item = servers.shift()

    // If we have no servers that we can hack, then there's nothing to prep
    if (!item) return

    const [server, score] = item

    // Always maintain one prep runner
    if (score > this.prepScore) {
      this.prepScore = score

      const runner = await this.batchRunnerFactory(server, score)
      this.prepRunner = runner
      this.prepRunner.prep().then(() => {
        // Only replace batch runner after preperation is complete
        this.batchRunner?.stop()

        this.batchRunner = runner
        this.prepRunner = null

        return runner.start()
      })
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
