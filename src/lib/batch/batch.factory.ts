import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'
import 'reflect-metadata'
import { NSIdentifier } from '../ns.identifier'
import { ThreadPlanner } from './planner'
import { Batch } from './batch'
import { ThreadManager } from '../thread-manager-v2'
import { Nuker } from '../utils/nuker'
import { ScriptAbortController } from '../utils/script-abort-controller'

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class BatchFactory {
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
  ) {
    this.ns.print('INFO BatchFactory Initialized')
  }

  create(target: string, priority?: number) {
    return new Batch(
      this.ns,
      this.threadPlanner,
      this.threadManager,
      this.nuker,
      this.scriptAbortController,
      target,
      priority,
    )
  }
}
