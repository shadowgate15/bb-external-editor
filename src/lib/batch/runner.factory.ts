import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'
import { NSIdentifier } from '../ns.identifier'
import { BatchFactory } from './batch.factory'
import { BatchRunner } from './runner'
import { PreperationLock } from './preperation-lock'
import { ScriptAbortController } from '../utils/script-abort-controller'

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
  ) {
    this.ns.print('INFO BatchRunnerFactory Initialized')
  }

  create(target: string, priority?: number) {
    return new BatchRunner(
      this.ns,
      this.batchFactory,
      this.preperationLock,
      this.scriptAbortController,
      target,
      priority,
    )
  }
}
