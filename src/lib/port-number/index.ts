import { BasePortNumberBuilder, PortNumberType } from './base'
import { BatchTitanPortNumberBuilder, Titan } from './titan'

export { PortProvider } from './provider'

export class PortNumberBuilder extends BasePortNumberBuilder {
  static fromServer(ns: NS, server: string) {
    return new PortNumberBuilder([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      ns.getServer(server).ip.split('.').join(''),
    ])
  }

  batch() {
    const portArray = [...this.portArray]

    portArray[PortNumberType.Titan] = String(Titan.Batch)

    return new BatchTitanPortNumberBuilder(this.portArray)
  }
}
