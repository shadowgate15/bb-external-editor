import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../ns.identifier'

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class RamChecker {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    this.ns.print('INFO RamChecker initialized')
  }

  getUsedRam(server: string): number {
    return this.ns.getServerUsedRam(server)
  }

  getMaxRam(server: string): number {
    return this.ns.getServerMaxRam(server)
  }

  getAvailableRam(server: string): number {
    return this.getMaxRam(server) - this.getUsedRam(server)
  }
}
