import 'reflect-metadata'

import { inject, injectable } from 'inversify'

import { NSIdentifier } from '@/lib/ns.identifier'

import { ThreadManager, UnallocatableServerError } from '../../thread-manager'
import { ScriptAbortController } from '../../utils/script-abort-controller'
import { BatchFactory, type IBatchFactory } from '../batch'
import { PreperationLock } from './preperation-lock'
import { PriorityProvider } from './priority-provider'
import { TargetProvider } from './target-provider'

@injectable('Singleton')
export class BatchRunner {
  private readonly abortController = new AbortController()

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(BatchFactory)
    private readonly batchFactory: IBatchFactory,

    @inject(PreperationLock)
    private readonly preperationLock: PreperationLock,

    @inject(ScriptAbortController)
    private readonly scriptAbortController: ScriptAbortController,

    @inject(ThreadManager)
    private readonly threadManager: ThreadManager,

    @inject(TargetProvider)
    readonly target: string,

    @inject(PriorityProvider)
    private readonly priority: number,
  ) {
    this.scriptAbortController.childController(this.abortController)
  }

  async prep() {
    const preparationPriority = this.priority * -1

    if (
      this.ns.getServerSecurityLevel(this.target) > this.ns.getServerMinSecurityLevel(this.target) ||
      this.ns.getServerMoneyAvailable(this.target) < this.ns.getServerMaxMoney(this.target)
    ) {
      await this.preperationLock.runExclusive(
        async () => {
          if (this.abortController.signal.aborted) return

          this.ns.toast(`Preparing "${this.target}" for hacking...`, 'info', null)
          await this.ns.asleep(100) // Let the toast show before starting the preparation

          // Preration step
          while (
            this.ns.getServerSecurityLevel(this.target) > this.ns.getServerMinSecurityLevel(this.target) ||
            this.ns.getServerMoneyAvailable(this.target) < this.ns.getServerMaxMoney(this.target)
          ) {
            try {
              if (this.abortController.signal.aborted) return

              const batch = await this.batchFactory(preparationPriority)

              await batch.tryRun(true)
              await this.ns.asleep(50)
            } catch (error) {
              this.ns.print(`ERROR Batch failed to run:\n  ${error}`)
              await this.threadManager.waitForThreadsToBeReleased()
            }
          }
        },
        1,
        preparationPriority,
      )
    }

    this.ns.toast(`Preparation of "${this.target}" is complete. Starting hack...`, 'success', null)
    await this.ns.asleep(100) // Let the toast show before starting the preparation
  }

  async start() {
    // Hacking step
    while (true) {
      try {
        if (this.abortController.signal.aborted) return

        const batch = await this.batchFactory()

        await batch.run()

        await this.ns.asleep(50)
      } catch (error) {
        this.ns.print(`ERROR Batch failed to run:\n  ${error}`)
        await this.threadManager.waitForThreadsToBeReleased()
        this.ns.print(`INFO Retrying batch for "${this.target}"`)
      }
    }
  }

  stop() {
    if (this.abortController.signal.aborted) return

    this.abortController.abort()
  }
}
