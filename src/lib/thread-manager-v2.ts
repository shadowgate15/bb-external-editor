import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'
import 'reflect-metadata'
import { NSIdentifier } from './ns.identifier'
import { ServerList } from './utils/server-list'
import { RamChecker } from './utils/ram-checker'
import { Mutex } from 'async-mutex'

export interface EventMap {
  released: []
}

export interface AllocationItem {
  /** The host that was allocated */
  host: string
  /** How many threads were allocated on the host */
  threads: number
  /** The function to call to release the allocated threads when they are no longer needed */
  release: () => void
}

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class ThreadManager {
  private readonly _mutex = new Mutex()

  private readonly _allocatableServers = new Map<string, AllocatableServer>()

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(ServerList)
    private readonly serverList: ServerList,

    @inject(RamChecker)
    private readonly ramChecker: RamChecker,
  ) {
    this.ns.print('INFO ThreadManager Initialized')

    this._setup()

    this.serverList.on('serverAdded', () => {
      this._setup()
    })
  }

  private _setup() {
    const servers = this.serverList.getAll()

    for (const server of servers) {
      if (this.ramChecker.getMaxRam(server) <= 0) continue

      if (!this._allocatableServers.has(server)) {
        this._allocatableServers.set(server, new AllocatableServer(this.ramChecker, server))
      }
    }
  }

  private get _sortedAllocatableServers() {
    return Array.from(this._allocatableServers.values()).sort((a, b) => {
      // If one of the servers is "home", prioritize it, since we want to run as many threads as possible on our own server before using up resources on other servers
      if (a[0] === 'home') return -1
      if (b[0] === 'home') return 1

      const diff = this.ramChecker.getMaxRam(b.name) - this.ramChecker.getMaxRam(a.name)

      if (diff !== 0) return diff

      return a.name.localeCompare(b.name)
    })
  }

  private filteredAllocatableServers(filter?: (server: string) => boolean) {
    if (filter) {
      return this._sortedAllocatableServers.filter((s) => filter(s.name))
    }

    return this._sortedAllocatableServers
  }

  async advancedAllocate(
    fn: (controller: AdvandedAllocationController) => Promise<void>,
    priority?: number,
    filter?: (server: string) => boolean,
  ) {
    await this._mutex.runExclusive(async () => {
      const tryAllocate = async (threads: number, scriptRam: number) => {
        let neededThreads = threads
        const allocations: AllocationItem[] = []

        for (const allocatableServer of this.filteredAllocatableServers(filter)) {
          // Escape early if we have allocated all needed threads
          if (neededThreads <= 0) break

          const [allocatedThreads, release] = allocatableServer.tryAllocateThreads(threads, scriptRam)

          if (allocatedThreads > 0) {
            allocations.push({
              host: allocatableServer.name,
              threads: allocatedThreads,
              release,
            })

            neededThreads -= allocatedThreads
          }
        }

        return allocations
      }

      await fn({
        tryAllocate,
        allocate: async (threads, scriptRam) => {
          const attemptedAllocations = await tryAllocate(threads, scriptRam)
          const totalAllocatedThreads = attemptedAllocations.reduce((sum, a) => sum + a.threads, 0)

          if (totalAllocatedThreads < threads) {
            for (const allocation of attemptedAllocations) {
              allocation.release()
            }

            throw E_NOT_ENOUGH_RAM
          }

          return attemptedAllocations
        },
        allocateOne: async (threads, scriptRam) => {
          for (const allocatableServer of this.filteredAllocatableServers(filter)) {
            try {
              const [allocatedThreads, release] = allocatableServer.allocateThreads(threads, scriptRam)

              return {
                host: allocatableServer.name,
                threads: allocatedThreads,
                release,
              }
            } catch (e) {
              if (e !== E_NOT_ENOUGH_RAM) throw e
            }
          }
        },
      })
    }, priority)
  }
}

export interface AllocationItem {
  /** The host that was allocated */
  host: string
  /** How many threads were allocated on the host */
  threads: number
  /** The function to call to release the allocated threads when they are no longer needed */
  release: () => void
}

export interface AdvandedAllocationController {
  /**
   * Allocates the requested number of threads on a single server.
   * If there is not enough RAM available on any single server, it will throw an error.
   */
  allocateOne(threads: number, scriptRam: number): Promise<AllocationItem>

  /**
   * Allocates the requested number of threads on multiple servers.
   * If there is not enough RAM available on any single server, it will throw an error.
   */
  allocate(threads: number, scriptRam: number): Promise<AllocationItem[]>

  /**
   * Allocates as many threads as possible on multiple servers up to the requested number of threads.
   */
  tryAllocate(threads: number, scriptRam: number): Promise<AllocationItem[]>
}

export class AllocatableServer {
  private _allocatedRam = 0

  constructor(
    private readonly ramChecker: RamChecker,

    public readonly name: string,
  ) {}

  /**
   * Allocates threads on this server.
   * The returned release function must be called when the threads are no longer needed to free up the allocated RAM.
   * This will either allocate the requested number of threads or throw an error if there is not enough RAM available.
   */
  allocateThreads(threads: number, scriptRam: number): [allocatedThreads: number, release: () => void] {
    const [threadsToAllocate, release] = this.tryAllocateThreads(threads, scriptRam)

    if (threadsToAllocate === 0) {
      release()

      throw E_NOT_ENOUGH_RAM
    }

    return [threadsToAllocate, release]
  }

  /**
   * Tries to allocate threads on this server. If there is not enough RAM available, it will allocate as many threads as possible.
   * The returned release function must be called when the threads are no longer needed to free up the allocated RAM.
   */
  tryAllocateThreads(threads: number, scriptRam: number): [allocatedThreads: number, release: () => void] {
    const maxPossibleThreads = Math.floor(this._getAvailableRam() / scriptRam)
    const threadsToAllocate = Math.min(threads, maxPossibleThreads)
    const ramToAllocate = threadsToAllocate * scriptRam

    this._allocatedRam += ramToAllocate

    return [
      threadsToAllocate,
      () => {
        this._allocatedRam -= ramToAllocate
      },
    ]
  }

  private _getAvailableRam() {
    return this.ramChecker.getMaxRam(this.name) - this._allocatedRam
  }
}

export const E_NOT_ENOUGH_RAM = new Error('Not enough RAM available to allocate threads')
