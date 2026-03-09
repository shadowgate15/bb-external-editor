import { once } from 'node:events'
import { BatchFactory } from './batch.factory'
import { PreperationLock } from './preperation-lock'
import { ScriptAbortController } from '../utils/script-abort-controller'

export class BatchRunner {
  private readonly abortController = new AbortController()

  constructor(
    private readonly ns: NS,
    private readonly batchFactory: BatchFactory,
    private readonly preperationLock: PreperationLock,
    private readonly scriptAbortController: ScriptAbortController,

    private readonly target: string,
    private readonly priority: number,
  ) {
    this.scriptAbortController.childController(this.abortController)
  }

  async start() {
    const preparationPriority = this.priority * -1

    await this.preperationLock.runExclusive(async () => {
      if (this.abortController.signal.aborted) return

      this.ns.toast(`Preparing "${this.target}" for hacking...`, 'info', 5000)

      // Preration step
      while (
        this.ns.getServerSecurityLevel(this.target) > this.ns.getServerMinSecurityLevel(this.target) ||
        this.ns.getServerMoneyAvailable(this.target) < this.ns.getServerMaxMoney(this.target)
      ) {
        if (this.abortController.signal.aborted) return

        const batch = this.batchFactory.create(this.target, preparationPriority)

        await batch.tryRun()
      }
    }, preparationPriority)

    this.ns.toast(`Preparation of "${this.target}" is complete. Starting hack...`, 'success', null)

    // Hacking step
    while (true) {
      if (this.abortController.signal.aborted) return

      const batch = this.batchFactory.create(this.target, this.priority)

      const isRunning = once(batch, 'release')

      batch.run()

      await isRunning
      await this.ns.asleep(50)
    }
  }

  stop() {
    if (this.abortController.signal.aborted) return

    this.abortController.abort()
  }
}
