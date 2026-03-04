import { nuke } from '@home/deploy/nuke'
import { ServerList } from '@home/deploy/server-list'
import { NS } from '@ns'
import { normalizeFlags } from './normalize-flags'

const GROW_SCRIPT = 'batch/grow.js'
const WEAKEN_SCRIPT = 'batch/weaken.js'
const HACK_SCRIPT = 'batch/hack.js'

export class ThreadCoordinator {
  private get servers() {
    const servers = ServerList.get(this.ns)

    if (normalizeFlags(this.ns).home) {
      servers.unshift('home')
    }

    return servers
  }

  constructor(private readonly ns: NS) {}

  /**
   * @returns number of threads that were added, will be -1 if there is not enough RAM on any server to add a single thread
   */
  private tryToAddThreads(
    target: string,
    threads: number,
    script: string,
    delay?: number,
    portNumber?: number,
  ): number {
    const scriptRam = this.ns.getScriptRam(script)

    const server = this.servers.find((s) => this.getAvailableRam(s) > scriptRam)

    if (!server) {
      return -1
    }

    const threadsToAdd = Math.min(threads, Math.floor(this.getAvailableRam(server) / scriptRam))

    this.ns.scp(script, server)

    nuke(this.ns, server)

    const args = [target, delay || 0]

    if (portNumber !== undefined) {
      args.push(portNumber)
    }

    this.ns.exec(script, server, { threads: threadsToAdd, temporary: true }, ...args)

    return threadsToAdd
  }

  private _makeAddThreadsFunction(script: string) {
    return (target: string, threads: number, delay?: number, portNumber?: number) => {
      let addedThreads = 0

      while (addedThreads < threads) {
        const result = this.tryToAddThreads(target, threads - addedThreads, script, delay, portNumber)

        if (result === -1) {
          throw new NotEnoughRamError()
        }

        addedThreads += result
      }
    }
  }

  readonly addGrowThreads = this._makeAddThreadsFunction(GROW_SCRIPT)
  readonly addWeakenThreads = this._makeAddThreadsFunction(WEAKEN_SCRIPT)
  readonly addHackThreads = this._makeAddThreadsFunction(HACK_SCRIPT)

  private getAvailableRam(server: string) {
    let maxRam = this.ns.getServerMaxRam(server)

    if (server === 'home') {
      maxRam = maxRam - 2 ** 10 // Reserve 1TB for home activities
    }

    return maxRam - this.ns.getServerUsedRam(server)
  }
}

export class NotEnoughRamError extends Error {
  constructor() {
    super('Not enough RAM to add more threads')
  }
}
