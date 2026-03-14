import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { Semaphore } from 'async-mutex'
import { inject, injectable } from 'inversify'
import { debounceTime, firstValueFrom, Subject } from 'rxjs'

import { NSIdentifier } from './ns.identifier'
import { RamChecker } from './utils/ram-checker'
import { ServerList } from './utils/server-list'

export interface AllocationItem {
  id: string
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
  private readonly _lock = new Semaphore(1)

  private readonly _allocatableServers = new Map<string, AllocatableServer>()

  private readonly threadsReleased = new Subject<void>()

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

    this.serverList.on('servers', () => {
      this._setup()
    })
  }

  private _setup() {
    const servers = this.serverList.getAll()

    for (const server of servers) {
      if (this.ramChecker.getMaxRam(server) <= 0) continue

      if (!this._allocatableServers.has(server)) {
        this._allocatableServers.set(server, new AllocatableServer(this.ns, this.ramChecker, server))
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
    await this._lock.runExclusive(
      async () => {
        const tryAllocate: AdvandedAllocationController['tryAllocate'] = async (threads, scriptRam, createProcess) => {
          let neededThreads = threads
          const createProcessPromises: Array<() => Promise<void>> = []

          for (const allocatableServer of this.filteredAllocatableServers(filter)) {
            // Escape early if we have allocated all needed threads
            if (neededThreads <= 0) break

            const allocatedThreads = allocatableServer.tryAllocateThreads(neededThreads, scriptRam)

            if (allocatedThreads > 0) {
              try {
                createProcessPromises.push(
                  await createProcess({
                    id: crypto.randomUUID(),
                    host: allocatableServer.name,
                    threads: allocatedThreads,
                    release: this._makeRelease(),
                  }),
                )

                neededThreads -= allocatedThreads
              } catch (e) {
                if (!(e instanceof UnallocatableServerError)) throw e
              }
            }
          }

          return [neededThreads, createProcessPromises] as const
        }

        await fn({
          tryAllocate,
          allocate: async (threads, scriptRam, createProcess) => {
            const [unallocated, createProcessPromises] = await tryAllocate(threads, scriptRam, createProcess)

            console.log('Allocation result', {
              unallocated,
              createProcessPromises,
            })
            if (unallocated !== 0) {
              throw new NotEnoughRAMError()
            }

            return createProcessPromises
          },
          allocateOne: async (threads, scriptRam, createProcess) => {
            for (const allocatableServer of this.filteredAllocatableServers(filter)) {
              try {
                const allocatedThreads = allocatableServer.allocateThreads(threads, scriptRam)

                if (allocatedThreads === threads) {
                  console.log('Allocation one result', {
                    allocatedThreads,
                    threads,
                  })

                  return await createProcess({
                    id: crypto.randomUUID(),
                    host: allocatableServer.name,
                    threads: allocatedThreads,
                    release: this._makeRelease(),
                  })
                }
              } catch (e) {
                if (!(e instanceof UnallocatableServerError)) throw e
              }
            }

            throw new NotEnoughRAMError()
          },
        })
      },
      1,
      priority,
    )
  }

  private _makeRelease() {
    let released = false
    return () => {
      if (released) return

      released = true
      this.threadsReleased.next()
    }
  }

  async waitForThreadsToBeReleased() {
    return firstValueFrom(
      this.threadsReleased.pipe(
        // Adding a debounce here to prevent waiting for multiple thread releases if they happen in quick succession,
        // which is common when a batch finishes and releases a lot of threads at once
        debounceTime(500),
      ),
    )
  }

  getAllocatableServer(host: string) {
    return this._allocatableServers.get(host)
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

export type CreateProcessFunction = (allocation: AllocationItem) => Promise<
  // The returned promise is expected to resolve when the process that was created with the allocated threads finishes,
  // so that the ThreadManager can keep track of when threads are released and potentially unblock waiting code that is waiting for threads to be released
  () => Promise<void>
>

export interface AdvandedAllocationController {
  /**
   * Allocates the requested number of threads on a single server.
   * If there is not enough RAM available on any single server, it will throw an error.
   */
  allocateOne(
    threads: number,
    scriptRam: number,
    createProcess: CreateProcessFunction,
  ): Promise<Awaited<ReturnType<CreateProcessFunction>>>

  /**
   * Allocates the requested number of threads on multiple servers.
   * If there is not enough RAM available on any single server, it will throw an error.
   */
  allocate(
    threads: number,
    scriptRam: number,
    createProcess: CreateProcessFunction,
  ): Promise<Array<Awaited<ReturnType<CreateProcessFunction>>>>

  /**
   * Allocates as many threads as possible on multiple servers up to the requested number of threads.
   *
   * @returns Number of unallocated threads
   */
  tryAllocate(
    threads: number,
    scriptRam: number,
    createProcess: CreateProcessFunction,
  ): Promise<[unallocated: number, createProcessPromises: Array<Awaited<ReturnType<CreateProcessFunction>>>]>
}

export class AllocatableServer {
  constructor(
    private readonly ns: NS,
    private readonly ramChecker: RamChecker,

    public readonly name: string,
  ) {}

  /**
   * Allocates threads on this server.
   * The returned release function must be called when the threads are no longer needed to free up the allocated RAM.
   * This will either allocate the requested number of threads or throw an error if there is not enough RAM available.
   */
  allocateThreads(threads: number, scriptRam: number): number {
    const threadsToAllocate = this.tryAllocateThreads(threads, scriptRam)

    if (threadsToAllocate === 0) {
      throw new NotEnoughRAMError()
    }

    return threadsToAllocate
  }

  /**
   * Tries to allocate threads on this server. If there is not enough RAM available, it will allocate as many threads as possible.
   * The returned release function must be called when the threads are no longer needed to free up the allocated RAM.
   */
  tryAllocateThreads(threads: number, scriptRam: number): number {
    const maxPossibleThreads = Math.floor(this._getAvailableRam() / scriptRam)
    const threadsToAllocate = Math.min(threads, maxPossibleThreads)

    if (maxPossibleThreads < threads) {
      // const ramToAllocate = threadsToAllocate * scriptRam
      // console.log('Found a server that cannot allocate the requested number of threads, skipping it', {
      //   name: this.name,
      //   maxRam: this.ramChecker.getMaxRam(this.name),
      //   usedRam: this.ramChecker.getUsedRam(this.name),
      //   neededRam: threads * scriptRam,
      //   ramToAllocate,
      //   maxPossibleThreads,
      // })
    }

    return threadsToAllocate
  }

  private _getAvailableRam() {
    let available = this.ramChecker.getAvailableRam(this.name)

    if (this.name === 'home') {
      available -= Number(this.ns.read('home-reserved-ram.txt')) || 0
    }

    return available
  }
}

export class UnallocatableServerError extends Error {}

export class NotEnoughRAMError extends UnallocatableServerError {
  constructor() {
    super('Not enough RAM available to allocate threads')
  }
}
