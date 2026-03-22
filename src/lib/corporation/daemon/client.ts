import { JSONRPCClient, TypedJSONRPCClient } from 'json-rpc-2.0'

import { PortNumberBuilder } from '@/lib/port-number'

import { ServerMethodMap } from './server.interface'

export class CoprationDaemonClient {
  protected readonly port: number

  protected readonly client: TypedJSONRPCClient<ServerMethodMap>

  constructor(protected readonly ns: NS) {
    this.port = PortNumberBuilder.fromServer(this.ns, 'home').corporation().daemon().build()

    this.client = new JSONRPCClient((request) => {
      this.ns.writePort(this.port, request)
    })
  }

  send<K extends Extract<keyof ServerMethodMap, string>>(method: K, params?: Parameters<ServerMethodMap[K]>[0]) {
    this.client.notify(method, params)
  }
}

export function createCorporationDaemonClient(ns: NS) {
  return new CoprationDaemonClient(ns)
}
