import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'
import { lastValueFrom, Subject } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { RamChecker } from '../utils/ram-checker'
import { ServerList } from '../utils/server-list'
import { BatchConfig } from './config'
import { type BatchRunnerFactory, RunnerFactory } from './runner'
import { BatchRunner } from './runner/runner'
import { ThreadPlanner } from './thread-planner'

const DATA_FILE = 'data/batch.json'

@injectable('Singleton')
@provide()
export class BatchManager extends Subject<void> {
  private initialized: boolean = false

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

    @inject(RamChecker)
    private readonly ramChecker: RamChecker,

    @inject(ThreadPlanner)
    private readonly threadPlanner: ThreadPlanner,
  ) {
    super()

    this.ns.print('INFO BatchManager Initialized')

    this.init()

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

  private async init() {
    if (this.initialized) return

    const prepHost = this.prepHost()
    if (prepHost) {
      this.prepRunner = await this.batchRunnerFactory(prepHost)

      this.prepRunner.prep().then(async () => {
        this.batchRunner?.stop()

        this.batchRunner = await this.batchRunnerFactory(prepHost)
        this.batchHost(prepHost)

        this.batchHost(null)
        this.prepRunner = null

        this.batchRunner.start()
      })
    }

    const batchHost = this.batchHost()
    if (batchHost) {
      this.batchRunner = await this.batchRunnerFactory(batchHost)

      this.batchRunner.start()
    }

    this.initialized = true
  }

  private readonly setupBatches = async () => {
    if (!this.initialized) return

    // No need to do any of this if we can't start prepping a server
    if (this.prepRunner !== null) return

    const servers = this.serverList
      .getAll()
      .filter((server) => this.validHackingLevel(server) && this.ns.hasRootAccess(server) && this.haveEnoughRAM(server))
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
      this.prepHost(configServer[0])

      runner.prep().then(() => {
        // Only replace batch runner after preperation is complete
        this.batchRunner?.stop()

        this.batchRunner = runner
        this.batchHost(configServer[0])

        this.prepHost(null)
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
      this.prepHost(server)
      this.prepRunner.prep().then(() => {
        // Only replace batch runner after preperation is complete
        this.batchRunner?.stop()

        this.batchRunner = runner
        this.batchHost(server)

        this.prepRunner = null
        this.prepHost(null)

        return runner.start()
      })
    }
  }

  private haveEnoughRAM(target: string): boolean {
    const server = this.ns.getServer(target)

    if (server.moneyMax === 0) return false

    const { weakenGrowThreads, weakenHackThreads, hackThreads, growThreads } = this.threadPlanner.plan({
      ...server,
      moneyAvailable: server.moneyMax,
      hackDifficulty: server.minDifficulty,
    })
    const weakenThreads = weakenGrowThreads + weakenHackThreads

    const growRams = this.ns.getScriptRam('share/batch/grow.js') * growThreads
    const requiredRams =
      growThreads +
      this.ns.getScriptRam('share/batch/weaken.js') * weakenThreads +
      this.ns.getScriptRam('share/batch/hack.js') * hackThreads

    const hasServerForGrow = this.serverList.getAll().some((server) => this.ramChecker.getMaxRam(server) > growRams)

    if (!hasServerForGrow) return false

    const totalRam =
      this.serverList.getAll().reduce((total, server) => total + this.ramChecker.getMaxRam(server), 0) * 0.9

    return totalRam >= requiredRams
  }

  private validHackingLevel(server: string) {
    let hackingLevel = this.ns.getHackingLevel()

    if (hackingLevel !== 1) {
      hackingLevel = hackingLevel / 2
    }

    return this.ns.getServerRequiredHackingLevel(server) <= hackingLevel
  }

  private _accessDataFile<T>(key: string, value?: T | null): T | null | undefined {
    const data = (() => {
      try {
        return JSON.parse(this.ns.read(DATA_FILE))
      } catch {
        return {}
      }
    })()

    if (value === undefined) {
      return data[key] as T
    }

    if (value === null) {
      this.ns.write(DATA_FILE, JSON.stringify({ ...data }), 'w')
    } else {
      this.ns.write(DATA_FILE, JSON.stringify({ ...data, [key]: value }), 'w')
    }

    return value
  }

  private batchHost(value?: string | null) {
    return this._accessDataFile<string>('batchHost', value)
  }

  private prepHost(value?: string | null) {
    return this._accessDataFile<string>('prepHost', value)
  }
}
