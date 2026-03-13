import { ThreadManager } from '../thread-manager'
import { ScriptAbortController } from '../utils/script-abort-controller'
import { BatchFactory } from './batch.factory'
import { PreperationLock } from './preperation-lock'

export class BatchRunner {
  private readonly abortController = new AbortController()

  constructor(
    private readonly ns: NS,
    private readonly batchFactory: BatchFactory,
    private readonly preperationLock: PreperationLock,
    private readonly scriptAbortController: ScriptAbortController,
    private readonly threadManager: ThreadManager,

    private readonly target: string,
    private readonly priority: number,
  ) {
    this.scriptAbortController.childController(this.abortController)
  }

  async start() {
    const preparationPriority = this.priority * -1

    if (
      this.ns.getServerSecurityLevel(this.target) > this.ns.getServerMinSecurityLevel(this.target) ||
      this.ns.getServerMoneyAvailable(this.target) < this.ns.getServerMaxMoney(this.target)
    ) {
      await this.preperationLock.runExclusive(
        async () => {
          if (this.abortController.signal.aborted) return

          this.ns.toast(`Preparing "${this.target}" for hacking...`, 'info', null)
          console.log(`BatchRunner: Starting preparation of "${this.target}"`)
          await this.ns.asleep(100) // Let the toast show before starting the preparation

          // Preration step
          while (
            this.ns.getServerSecurityLevel(this.target) > this.ns.getServerMinSecurityLevel(this.target) ||
            this.ns.getServerMoneyAvailable(this.target) < this.ns.getServerMaxMoney(this.target)
          ) {
            try {
              if (this.abortController.signal.aborted) return

              const batch = this.batchFactory.create(this.target, preparationPriority)

              await batch.tryRun()
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

    // Hacking step
    while (true) {
      try {
        if (this.abortController.signal.aborted) return

        const batch = this.batchFactory.create(this.target, this.priority)

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
