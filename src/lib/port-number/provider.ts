import { inject, injectable } from 'inversify'

import { NSIdentifier } from '@/lib/ns.identifier'
import { PortNumberBuilder } from '@/lib/port-number'
import { BasePortNumberBuilder } from '@/lib/port-number/base'

import { GROW_SCRIPT, HACK_SCRIPT, WEAKEN_SCRIPT } from '../batch/batch/constants'

@injectable('Singleton')
export class PortProvider {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {}

  private readonly usedPorts: Set<number> = new Set()

  private _batchParent() {
    return PortNumberBuilder.fromServer(this.ns, this.ns.getHostname()).batch().parent().fillRandom()
  }

  batchParent() {
    let port = this._batchParent()

    while (this.usedPorts.has(port)) {
      port = this._batchParent()
    }

    this.usedPorts.add(port)

    return [port, () => this.usedPorts.delete(port)] as const
  }

  private _batchChild(script: string, target: string) {
    const batchBuilder = PortNumberBuilder.fromServer(this.ns, target).batch()
    let childBuilder: BasePortNumberBuilder

    switch (script) {
      case HACK_SCRIPT: {
        childBuilder = batchBuilder.hack()
        break
      }
      case WEAKEN_SCRIPT: {
        childBuilder = batchBuilder.weaken()
        break
      }
      case GROW_SCRIPT: {
        childBuilder = batchBuilder.grow()
        break
      }
    }

    return childBuilder.fillRandom()
  }

  batchChild(script: string, target: string) {
    let port = this._batchChild(script, target)

    while (this.usedPorts.has(port)) {
      port = this._batchChild(script, target)
    }

    this.usedPorts.add(port)

    return [port, () => this.usedPorts.delete(port)] as const
  }
}
