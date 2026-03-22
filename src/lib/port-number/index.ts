import { BasePortNumberBuilder, PortNumberType } from './base'
import { BatchTitanPortNumberBuilder, CorporationTitanPortNumberBuilder, Titan } from './titan'

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

  corporation() {
    return new CorporationTitanPortNumberBuilder(this.assignPort(PortNumberType.Titan, Titan.Corporation))
  }
}
