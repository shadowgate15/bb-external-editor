import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'
import 'reflect-metadata'
import { NSIdentifier } from './ns.identifier'
import { ServerList } from './utils/server-list'
import { RamChecker } from './utils/ram-checker'
import { Semaphore } from './utils/semaphore'
import { E_ALREADY_LOCKED, SemaphoreInterface, tryAcquire } from 'async-mutex'

export interface EventMap {
  released: []
}

export interface AllocationItem {
  /** The host that was allocated */
  host: string
  /** How many threads were allocated on the host */
  weight: number
  /** The function to call to release the allocated threads when they are no longer needed */
  release: SemaphoreInterface.Releaser
}

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class ThreadManager {
  // TODO: chagne this to a custom thread pool that tracks the RAM allocation
  // then use a mutex to lock access to the pool.
  // Hopefully this will reduce the event loop burden, because each time a realease happens
  // the semaphore is iterating over it's queue to find the next waiting acquire that can be fulfilled,
  // which can cause some lag when there are a lot of waiting acquires and releases happening at the same time
  private semaphoresMap: Map<string, Semaphore> = new Map()

  private get semaphores(): [host: string, semaphore: Semaphore][] {
    return Array.from(this.semaphoresMap.entries()).sort((a, b) => {
      // If one of the servers is "home", prioritize it, since we want to run as many threads as possible on our own server before using up resources on other servers
      if (a[0] === 'home') return -1
      if (b[0] === 'home') return 1

      return b[1].getMaxValue() - a[1].getMaxValue()
    })
  }

  readonly threadLock = new Semaphore(0)

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(ServerList)
    private readonly serverList: ServerList,

    @inject(RamChecker)
    private readonly ramChecker: RamChecker,
  ) {
    this.ns.print('INFO ThreadManager Initialized')

    this.setupSemaphores()

    this.serverList.on('serverAdded', () => {
      this.setupSemaphores()
    })
  }

  private getMaxRam(server: string) {
    let maxRam = this.ramChecker.getMaxRam(server)

    if (server === 'home') {
      maxRam -= Number(this.ns.read('home-reserved-ram.txt')) || 0
    }

    return maxRam
  }

  private setupSemaphores() {
    const servers = this.serverList.getAll()

    for (const server of servers) {
      // Have to have root access to the server and some RAM to run threads on it, otherwise we can't run anything on it
      if (this.ns.hasRootAccess(server) && this.ramChecker.getMaxRam(server) > 0) {
        const maxRam = this.getMaxRam(server)

        if (maxRam <= 0) {
          continue
        }

        if (this.semaphoresMap.has(server)) {
          const semaphore = this.semaphoresMap.get(server)

          if (semaphore === undefined) {
            throw new Error('Semaphore should be defined since we checked it with has()')
          }

          if (semaphore.getMaxValue() !== maxRam) {
            // Update the value of the existing semaphore to reflect any changes in the server's RAM
            const diff = semaphore.setMaxValue(maxRam)
            this.threadLock.addToMaxValue(diff)
          }
        } else {
          const semaphore = new Semaphore(maxRam)

          // Add a new semaphore for the server, with the initial value set to the server's max RAM
          this.semaphoresMap.set(server, semaphore)
          this.threadLock.addToMaxValue(maxRam)
        }
      }
    }
  }

  async tryAllocate(
    weight?: number,
    priority = 0,
    bucketRam: number | undefined = undefined,
  ): Promise<{ unallocated: number; allocated: AllocationItem[] }> {
    let neededWeight = weight ?? 1

    const allocations: AllocationItem[] = []

    for (const [host, semaphore] of this.semaphores) {
      try {
        const assignedWeight = Math.min(this.getMaxPossibleWeight(semaphore, bucketRam), neededWeight)

        if (assignedWeight === 0) {
          throw E_ALREADY_LOCKED
        }

        const [, release] = await tryAcquire(semaphore).acquire(assignedWeight, priority)

        const returnedWeight = Math.ceil(bucketRam ? assignedWeight / bucketRam : assignedWeight)
        allocations.push({
          host,
          weight: returnedWeight,
          release,
        })
        neededWeight -= assignedWeight

        if (neededWeight <= 0) {
          break
        }
      } catch (e) {
        if (e !== E_ALREADY_LOCKED) throw e
      }
    }

    return {
      unallocated: neededWeight,
      allocated: allocations,
    }
  }

  async tryAllocateToOne(weight?: number, priority = 0, bucketRam: number | undefined = undefined) {
    const neededWeight = weight ?? 1
    const semaphoresWithEnoughWeight = this.semaphores.filter(
      ([_, semaphore]) => this.getMaxPossibleWeight(semaphore, bucketRam) >= neededWeight,
    )

    let allocation: AllocationItem | null = null

    for (const [host, semaphore] of semaphoresWithEnoughWeight) {
      try {
        const [, release] = await tryAcquire(semaphore).acquire(neededWeight, priority)

        const returnedWeight = Math.ceil(bucketRam ? neededWeight / bucketRam : neededWeight)
        allocation = {
          host,
          weight: returnedWeight,
          release,
        }

        break
      } catch (e) {
        if (e !== E_ALREADY_LOCKED) throw e
      }
    }

    if (allocation === null) {
      throw E_NOT_ENOUGH_RESOURCES
    }

    return allocation
  }

  /**
   * Gets the max weight that can be allocated on the given semaphore,
   * taking into account the bucket RAM if it is provided
   */
  private getMaxPossibleWeight(semaphore: Semaphore, bucketRam: number | undefined) {
    const value = semaphore.getValue()

    if (bucketRam === undefined) return value

    const maxBuckets = Math.floor(value / bucketRam)

    return maxBuckets * bucketRam
  }
}

export const E_NOT_ENOUGH_RESOURCES = new Error('Not enough resources available to allocate the requested weight')
