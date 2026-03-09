import { provide } from '@inversifyjs/binding-decorators'
import { Mutex } from 'async-mutex'
import { inject, injectable } from 'inversify'
import 'reflect-metadata'
import { NSIdentifier } from '../ns.identifier'

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class PreperationLock extends Mutex {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    super()

    this.ns.print('INFO PreperationLock Initialized')
  }
}
