import 'reflect-metadata'

import { inject, injectable } from 'inversify'
import { filter, lastValueFrom, Observable, Subject, Subscriber } from 'rxjs'

import { NSIdentifier } from '@/lib/ns.identifier'
import { PortProvider } from '@/lib/port-number'

import {
  AdvandedAllocationController,
  AllocationItem,
  ThreadManager,
  UnallocatableServerError,
} from '../../thread-manager'
import { Nuker } from '../../utils/nuker'
import { ScriptAbortController } from '../../utils/script-abort-controller'
import {
  createParentChannel,
  errorEventFilter,
  ParentChannelSubject,
  pongEventFilter,
  readyEventFilter,
} from '../channel/parent'
import { PriorityProvider } from '../runner/priority-provider'
import { TargetProvider } from '../runner/target-provider'
import { GROW_SCRIPT, HACK_SCRIPT, WEAKEN_SCRIPT } from './constants'
import { Plan, ThreadPlanner } from './planner'

export interface EventMap {
  release: []
}

/**
 * This class is responsible for coordinating the four scripts in a batch
 */
@injectable('Singleton')
export class Batch {
  // Subtracting 1 from the RAM usage of each script to account for zod.run being counted in the calculation
  private readonly HACK_SCRIPT_RAM = this.ns.getScriptRam(HACK_SCRIPT) - 1
  private readonly GROW_SCRIPT_RAM = this.ns.getScriptRam(GROW_SCRIPT) - 1
  private readonly WEAKEN_SCRIPT_RAM = this.ns.getScriptRam(WEAKEN_SCRIPT) - 1

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(ThreadPlanner)
    private readonly threadPlanner: ThreadPlanner,

    @inject(ThreadManager)
    private readonly threadManager: ThreadManager,

    @inject(Nuker)
    private readonly nuker: Nuker,

    @inject(ScriptAbortController)
    private readonly scriptAbortController: ScriptAbortController,

    @inject(PortProvider)
    private readonly portProvider: PortProvider,

    /** The host to target for the batch */
    @inject(TargetProvider)
    private readonly target: string,

    /** Priority of the batch, higher priority batches will be executed first when there are multiple batches waiting to run */
    @inject(PriorityProvider)
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
  async run(prep?: boolean) {
    return lastValueFrom(
      new Observable<void>((subscriber) => {
        this.threadManager
          .advancedAllocate(
            async (controller) => {
              const plan = this.threadPlanner.plan()

              // NOTE: We are not awaiting this on purpose,
              // since the subscriber will be completed when the batch is done in the _deploy method,
              this._deploy(plan, controller, subscriber).catch((e) => {
                subscriber.error(e)
              })
            },
            this.priority,
            prep ? this._prepServerFilter.bind(this) : this._serverFilter.bind(this),
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
  async tryRun(prep?: boolean) {
    return lastValueFrom(
      new Observable<void>((subscriber) => {
        this.threadManager
          .advancedAllocate(
            async (controller) => {
              const plan = this.threadPlanner.planPrep()

              this._tryDeploy(plan, controller)
                .then(() => {
                  subscriber.next()
                  subscriber.complete()
                })
                .catch((e) => {
                  subscriber.error(e)
                })
            },
            this.priority,
            prep ? this._prepServerFilter.bind(this) : this._serverFilter.bind(this),
          )
          .catch((e) => {
            subscriber.error(e)
          })
      }),
    )
  }

  private _setupDeploy(plan: Plan, subscriber?: Subscriber<void>) {
    const { totalThreads } = plan

    let readyThreads: number = 0

    const subject: ParentChannelSubject = new Subject()

    const abortController = new AbortController()
    this.scriptAbortController.childController(abortController)

    // Timeout to prevent hanging batches in case something goes wrong
    // and the workers never become ready or an error is never emitted
    const timeout = setTimeout(() => {
      this.ns.print('ERROR Batch timed out, aborting...')
      abortController.abort()
    }, 5000)

    subject.pipe(readyEventFilter).subscribe(({ threads }) => {
      readyThreads += threads
      this.ns.print(
        `INFO Received ready event for ${threads} threads, total ready threads: ${readyThreads}/${totalThreads}`,
      )

      if (readyThreads === totalThreads) {
        clearTimeout(timeout)
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

    console.log('Starting batch with the following plan:', plan)

    try {
      const processes = [
        await controller.allocate(
          hackThreads,
          this.HACK_SCRIPT_RAM,
          this._deployHack.bind(this, hackDelay, subject, abortController),
        ),
        await controller.allocate(
          weakenHackThreads,
          this.WEAKEN_SCRIPT_RAM,
          this._deployWeaken.bind(this, weakenHackDelay, subject, abortController),
        ),
        await controller.allocateOne(
          growThreads,
          this.GROW_SCRIPT_RAM,
          this._deployGrow.bind(this, growDelay, subject, abortController),
        ),
        await controller.allocate(
          weakenGrowThreads,
          this.WEAKEN_SCRIPT_RAM,
          this._deployWeaken.bind(this, weakenGrowDelay, subject, abortController),
        ),
      ]

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

        const [parent, releaseParent] = this.portProvider.batchParent()
        const [child, releaseChild] = this.portProvider.batchChild(script, this.target)
        const channel = createParentChannel(this.ns, subject, delay, parent, child)

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

        const pingId = crypto.randomUUID()
        const ping = setInterval(() => {
          channel.send('ping', pingId)
        }, 100)

        abortController.signal.addEventListener('abort', () => {
          clearInterval(ping)
          this.ns.kill(pid)
        })

        return () =>
          listenPromise.finally(() => {
            releaseParent()
            releaseChild()
            allocation.release()
          })
      } finally {
        allocation.release()
      }
    }
  }

  private _deployHack = this._makeDeploy(HACK_SCRIPT)
  private _deployGrow = this._makeDeploy(GROW_SCRIPT)
  private _deployWeaken = this._makeDeploy(WEAKEN_SCRIPT)

  private _serverFilter(server: string) {
    return this.ns.hasRootAccess(server)
  }

  private _prepServerFilter(server: string) {
    return (
      this.ns.hasRootAccess(server) &&
      server !== 'home' &&
      !this.ns
        .getPurchasedServers()
        .filter((s) => !s.startsWith('prep'))
        .includes(server)
    )
  }
}

export class FailedToStartScriptError extends UnallocatableServerError {
  constructor() {
    super('Failed to start script')
  }
}
