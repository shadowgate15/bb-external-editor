import { filter, lastValueFrom, Observable, Subject, Subscriber } from 'rxjs'

import {
  AdvandedAllocationController,
  AllocationItem,
  ThreadManager,
  UnallocatableServerError,
} from '../thread-manager'
import { Nuker } from '../utils/nuker'
import { ScriptAbortController } from '../utils/script-abort-controller'
import {
  createParentChannel,
  errorEventFilter,
  ParentChannelSubject,
  pongEventFilter,
  readyEventFilter,
} from './channel/parent'
import { Plan, ThreadPlanner } from './planner'

export interface EventMap {
  release: []
}

/**
 * This class is responsible for coordinating the four scripts in a batch
 */
export class Batch {
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
  ) {}

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
    return lastValueFrom(
      new Observable<void>((subscriber) => {
        this.threadManager
          .advancedAllocate(
            async (controller) => {
              const plan = this.threadPlanner.plan(this.target)

              await this._deploy(plan, controller, subscriber)
            },
            this.priority,
            this._serverFilter.bind(this),
          )
          .catch((e) => {
            subscriber.error(e)
          })
      }),
    )
  }

  /**
   * This will run as many threads as possible for the batch, even if not all threads can be allocated.
   */
  async tryRun() {
    return this.threadManager.advancedAllocate(
      async (controller) => {
        const plan = this.threadPlanner.planPrep(this.target)

        await this._tryDeploy(plan, controller)
      },
      this.priority,
      this._serverFilter.bind(this),
    )
  }

  private _setupDeploy(plan: Plan, subscriber?: Subscriber<void>) {
    const { weakenGrowDelay, totalThreads } = plan

    let readyThreads: number = 0

    const subject: ParentChannelSubject = new Subject()

    const abortController = new AbortController()
    this.scriptAbortController.childController(abortController)

    // Timeout to prevent hanging batches in case something goes wrong
    // and the workers never become ready or an error is never emitted
    const timeout = setTimeout(
      () => {
        this.ns.print('ERROR Batch timed out, aborting...')
        abortController.abort()
      },
      this.ns.getWeakenTime(this.target) + weakenGrowDelay + 1000 * 100,
    )

    subject.pipe(readyEventFilter).subscribe(({ threads }) => {
      readyThreads += threads

      if (readyThreads === totalThreads) {
        subject.next({
          type: 'startTime',
          startTime: Date.now() + 100,
        })

        subscriber?.next()
        subscriber?.complete()
      }
    })

    subject.pipe(errorEventFilter).subscribe(({ error }) => {
      this.ns.print(`ERROR Worker error: ${error}`)

      // This will allow the runner to continue if something happens
      subscriber?.next()
      subscriber?.complete()

      abortController.abort()
    })

    return {
      subject,
      abortController,
      timeout,
    }
  }

  private async _deploy(plan: Plan, controller: AdvandedAllocationController, subscriber?: Subscriber<void>) {
    const {
      hackThreads,
      hackDelay,
      growThreads,
      growDelay,
      weakenGrowThreads,
      weakenGrowDelay,
      weakenHackThreads,
      weakenHackDelay,
    } = plan

    const { subject, abortController, timeout } = this._setupDeploy(plan, subscriber)

    try {
      const processes = await Promise.all([
        controller.allocate(
          hackThreads,
          this.HACK_SCRIPT_RAM,
          this._deployHack.bind(this, hackDelay, subject, abortController),
        ),
        controller.allocate(
          weakenHackThreads,
          this.WEAKEN_SCRIPT_RAM,
          this._deployWeaken.bind(this, weakenHackDelay, subject, abortController),
        ),
        controller.allocateOne(
          growThreads,
          this.GROW_SCRIPT_RAM,
          this._deployGrow.bind(this, growDelay, subject, abortController),
        ),
        controller.allocate(
          weakenGrowThreads,
          this.WEAKEN_SCRIPT_RAM,
          this._deployWeaken.bind(this, weakenGrowDelay, subject, abortController),
        ),
      ])

      await Promise.all(processes.flat().map((process) => process()))
    } catch (e) {
      abortController.abort()

      throw e
    } finally {
      clearTimeout(timeout)
      subject.complete()

      if (!subscriber?.closed) {
        subscriber?.next()
        subscriber?.complete()
      }
    }
  }

  private async _tryDeploy(plan: Plan, controller: AdvandedAllocationController) {
    const {
      hackThreads,
      hackDelay,
      growThreads,
      growDelay,
      weakenGrowThreads,
      weakenGrowDelay,
      weakenHackThreads,
      weakenHackDelay,
    } = plan

    const { subject, abortController, timeout } = this._setupDeploy(plan)

    try {
      const processes = await Promise.all([
        controller.tryAllocate(
          hackThreads,
          this.HACK_SCRIPT_RAM,
          this._deployHack.bind(this, hackDelay, subject, abortController),
        ),
        controller.tryAllocate(
          weakenHackThreads,
          this.WEAKEN_SCRIPT_RAM,
          this._deployWeaken.bind(this, weakenHackDelay, subject, abortController),
        ),
        controller.tryAllocate(
          growThreads,
          this.GROW_SCRIPT_RAM,
          this._deployGrow.bind(this, growDelay, subject, abortController),
        ),
        controller.tryAllocate(
          weakenGrowThreads,
          this.WEAKEN_SCRIPT_RAM,
          this._deployWeaken.bind(this, weakenGrowDelay, subject, abortController),
        ),
      ])

      await Promise.all(
        processes
          .map(([unallocated, processes]) => {
            if (unallocated > 0) {
              // We are going to mark the unallocated threads as ready
              // so that the batch can start with the threads that were allocated,
              subject.next({
                type: 'ready',
                threads: unallocated,
              })
            }

            return processes
          })
          .flat()
          .map((process) => process()),
      )
    } catch (e) {
      abortController.abort()

      throw e
    } finally {
      clearTimeout(timeout)
      subject.complete()
    }
  }

  private _makeDeploy(script: string) {
    return async (
      delay: number,
      subject: ParentChannelSubject,
      abortController: AbortController,
      allocation: AllocationItem,
    ) => {
      try {
        if (abortController.signal.aborted) return

        this.nuker.nuke(allocation.host)

        this.ns.scp(script, allocation.host)

        const [channel, parent, child] = createParentChannel(this.ns, subject, delay)

        // Shut down the channel if the batch is aborted
        abortController.signal.addEventListener('abort', () => {
          channel.close()
        })

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

        if (pid === 0) {
          this.ns.print(
            `ERROR Failed to start script ${script} on host ${allocation.host} with ${allocation.threads} threads and args "${args.join(' ')}"`,
            {
              maxRam: this.ns.getServerMaxRam(allocation.host),
              usedRam: this.ns.getServerUsedRam(allocation.host),
            },
          )

          throw new FailedToStartScriptError()
        }

        const pingId = crypto.randomUUID()
        const ping = setInterval(() => {
          channel.send('ping', pingId)
        }, 100)

        subject
          .pipe(
            pongEventFilter,
            filter(({ id }) => id === pingId),
          )
          .subscribe(() => {
            clearInterval(ping)

            subject.next({
              type: 'ready',
              threads: allocation.threads,
            })
          })

        abortController.signal.addEventListener('abort', () => {
          clearInterval(ping)
          this.ns.kill(pid)
        })

        return () =>
          listenPromise.finally(() => {
            allocation.release()
          })
      } finally {
        allocation.release()
      }
    }
  }

  private _deployHack = this._makeDeploy(this.HACK_SCRIPT)
  private _deployGrow = this._makeDeploy(this.GROW_SCRIPT)
  private _deployWeaken = this._makeDeploy(this.WEAKEN_SCRIPT)

  private _serverFilter(server: string) {
    return this.ns.hasRootAccess(server)
  }
}

export class FailedToStartScriptError extends UnallocatableServerError {
  constructor() {
    super('Failed to start script')
  }
}
