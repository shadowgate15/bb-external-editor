import { Plan, ThreadPlanner } from './planner'
import { EventEmitter } from 'node:events'
import { createParentChannel, ParentChannelEventMap } from './channel/parent'
import { AllocationItem, ThreadManager } from '../thread-manager-v2'
import { Nuker } from '../utils/nuker'
import { ScriptAbortController } from '../utils/script-abort-controller'

export interface EventMap {
  release: []
}

/**
 * This class is responsible for coordinating the four scripts in a batch
 */
export class Batch extends EventEmitter<EventMap> {
  private readonly HACK_SCRIPT = 'share/batch/hack.js'
  private readonly GROW_SCRIPT = 'share/batch/grow.js'
  private readonly WEAKEN_SCRIPT = 'share/batch/weaken.js'

  // Subtracting 1 from the RAM usage of each script to account for zod.run being counted in the calculation
  private readonly HACK_SCRIPT_RAM = this.ns.getScriptRam(this.HACK_SCRIPT) - 1
  private readonly GROW_SCRIPT_RAM = this.ns.getScriptRam(this.GROW_SCRIPT) - 1
  private readonly WEAKEN_SCRIPT_RAM = this.ns.getScriptRam(this.WEAKEN_SCRIPT) - 1

  constructor(
    private readonly ns: NS,

    private readonly threadPlanner: ThreadPlanner,

    private readonly threadManager: ThreadManager,

    private readonly nuker: Nuker,

    private readonly scriptAbortController: ScriptAbortController,

    /** The host to target for the batch */
    private readonly target: string,

    /** Priority of the batch, higher priority batches will be executed first when there are multiple batches waiting to run */
    private readonly priority: number = 0,
  ) {
    super()
  }

  /**
   * This will only run if all threads for the batch can be allocated,
   * otherwise it will release any allocated threads and not run at all.
   * This is to ensure that batches either run fully or not at all,
   * since running only part of a batch can have negative consequences on the target server
   * (for example,
   *   running hack threads without the corresponding weaken threads can increase the security level of the target server,
   *   making future batches less effective).
   *
   * This will throw an error if there are not enough threads available to run the batch,
   * so it is recommended to catch any errors when calling this method and handle them appropriately
   * (for example, by retrying after some time or by logging the error and moving on to the next batch).
   */
  async run() {
    let pDeploy: Promise<void>

    await this.threadManager.advancedAllocate(
      async (controller) => {
        const plan = this.threadPlanner.plan(this.target)
        const { hackThreads, weakenHackThreads, growThreads, weakenGrowThreads } = plan

        const hackAllocations = await controller.allocate(hackThreads, this.HACK_SCRIPT_RAM)
        const weakenHackAllocations = await controller
          .allocate(weakenHackThreads, this.WEAKEN_SCRIPT_RAM)
          .catch((e) => {
            this.releaseAllocations(hackAllocations)

            throw e
          })
        const growAllocation = await controller.allocateOne(growThreads, this.GROW_SCRIPT_RAM).catch((e) => {
          this.releaseAllocations([...hackAllocations, ...weakenHackAllocations])

          throw e
        })
        const weakenGrowAllocations = await controller
          .allocate(weakenGrowThreads, this.WEAKEN_SCRIPT_RAM)
          .catch((e) => {
            this.releaseAllocations([...hackAllocations, ...weakenHackAllocations, growAllocation])

            throw e
          })

        pDeploy = this._deploy(plan, [hackAllocations, weakenHackAllocations, [growAllocation], weakenGrowAllocations])
      },
      this.priority,
      this._serverFilter.bind(this),
    )

    await pDeploy
  }

  /**
   * This will run as many threads as possible for the batch, even if not all threads can be allocated.
   */
  async tryRun() {
    let pDeploy: Promise<void>

    await this.threadManager.advancedAllocate(
      async (controller) => {
        const plan = this.threadPlanner.plan(this.target)
        const { hackThreads, weakenHackThreads, growThreads, weakenGrowThreads } = plan

        const hackAllocations = await controller.tryAllocate(hackThreads, this.HACK_SCRIPT_RAM)
        const weakenHackAllocations = await controller.tryAllocate(weakenHackThreads, this.WEAKEN_SCRIPT_RAM)
        const growAllocations = await controller.tryAllocate(growThreads, this.GROW_SCRIPT_RAM)
        const weakenGrowAllocations = await controller.tryAllocate(weakenGrowThreads, this.WEAKEN_SCRIPT_RAM)

        pDeploy = this._deploy(plan, [hackAllocations, weakenHackAllocations, growAllocations, weakenGrowAllocations])
      },
      this.priority,
      this._serverFilter.bind(this),
    )

    await pDeploy
  }

  private async releaseAllocations(allocations: AllocationItem[]) {
    for (const allocation of allocations) {
      allocation.release()
    }
  }

  private async _deploy(
    plan: Plan,
    [hackAllocations, weakenHackAllocations, growAllocations, weakenGrowAllocations]: AllocationItem[][],
  ) {
    const { hackDelay, growDelay, weakenGrowDelay, weakenHackDelay } = plan

    let readyCount = 0
    const total =
      hackAllocations.length + weakenHackAllocations.length + growAllocations.length + weakenGrowAllocations.length

    const emitter = new EventEmitter<ParentChannelEventMap>()

    const abortController = new AbortController()
    this.scriptAbortController.childController(abortController)

    emitter.on('ready', () => {
      readyCount++

      if (readyCount === total) {
        emitter.emit('startTime', Date.now() + 100)
        this.emit('release')
      }
    })

    emitter.on('error', (error: unknown, _worker: number) => {
      this.ns.print(`ERROR Worker error: ${error}`)

      // This will allow the runner to continue if something happens
      this.emit('release')

      if (!abortController.signal.aborted) {
        abortController.abort()
      }
    })

    await Promise.all([
      this._deployHack(hackDelay, hackAllocations, emitter, abortController.signal),
      this._deployWeaken(weakenHackDelay, weakenHackAllocations, emitter, abortController.signal),
      this._deployGrow(growDelay, growAllocations, emitter, abortController.signal),
      this._deployWeaken(weakenGrowDelay, weakenGrowAllocations, emitter, abortController.signal),
    ])
  }

  private _makeDeploy(script: string) {
    return (
      delay: number,
      allocations: AllocationItem[],
      emitter: EventEmitter<ParentChannelEventMap>,
      abortSignal: AbortSignal,
    ) => {
      return Promise.all(
        allocations.map(async (allocation) => {
          this.nuker.nuke(allocation.host)

          this.ns.scp(script, allocation.host)

          const [channel, parent, child] = createParentChannel(this.ns, emitter, delay)

          const listenPromise = channel.listen()

          const args = [
            ['--target', this.target],
            ['--from', child],
            ['--to', parent],
          ].flat()

          const pid = this.ns.exec(
            script,
            allocation.host,
            {
              threads: allocation.threads,
              temporary: true,
              // To account for zod
              ramOverride: this.ns.getScriptRam(script) - 1,
            },
            ...args,
          )

          abortSignal.addEventListener('abort', () => {
            this.ns.kill(pid)
            channel.close()
          })

          return listenPromise.finally(() => {
            allocation.release()
          })
        }),
      )
    }
  }

  private _deployHack = this._makeDeploy(this.HACK_SCRIPT)
  private _deployGrow = this._makeDeploy(this.GROW_SCRIPT)
  private _deployWeaken = this._makeDeploy(this.WEAKEN_SCRIPT)

  private _serverFilter(server: string) {
    return this.ns.hasRootAccess(server)
  }
}
