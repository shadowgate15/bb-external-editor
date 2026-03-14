import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { Semaphore } from 'async-mutex'
import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../../ns.identifier'

@injectable('Singleton')
@provide()
export class PreperationLock extends Semaphore {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    super(5)

    this.ns.print('INFO PreperationLock Initialized')
  }
}
