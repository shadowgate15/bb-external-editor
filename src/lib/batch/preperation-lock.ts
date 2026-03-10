import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { Semaphore } from 'async-mutex'
import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../ns.identifier'

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class PreperationLock extends Semaphore {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    super(2)

    this.ns.print('INFO PreperationLock Initialized')
  }
}
