import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../ns.identifier'
import { ThreadManager } from '../thread-manager'
import { ScriptAbortController } from '../utils/script-abort-controller'
import { BatchFactory } from './batch.factory'
import { PreperationLock } from './preperation-lock'
import { BatchRunner } from './runner'

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class BatchRunnerFactory {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(BatchFactory)
    private readonly batchFactory: BatchFactory,

    @inject(PreperationLock)
    private readonly preperationLock: PreperationLock,

    @inject(ScriptAbortController)
    private readonly scriptAbortController: ScriptAbortController,

    @inject(ThreadManager)
    private readonly threadManager: ThreadManager,
  ) {
    this.ns.print('INFO BatchRunnerFactory Initialized')
  }

  create(target: string, priority?: number) {
    return new BatchRunner(
      this.ns,
      this.batchFactory,
      this.preperationLock,
      this.scriptAbortController,
      this.threadManager,
      target,
      priority,
    )
  }
}
