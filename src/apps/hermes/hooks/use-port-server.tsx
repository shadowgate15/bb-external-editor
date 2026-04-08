import React from 'react'
import { Subject } from 'rxjs'

import { NSChannelServer } from '@/lib/channel'
import { PortNumberBuilder } from '@/lib/port-number'
import { ClientMethodMap as CorporationClientMethodMap } from '@/lib/zeus/daemon/server.interface'

type MethodMap = CorporationClientMethodMap

export type Response = {
  action: 'zeusConfig'
  data: Parameters<CorporationClientMethodMap['zeusConfig']>[0]
}

export class PortServer extends NSChannelServer<MethodMap> {
  readonly port: number

  readonly responses$$ = new Subject<Response>()

  constructor(ns: NS) {
    const port = PortNumberBuilder.fromServer(ns, 'home').hermes().server().build()

    super(ns, port)

    this.port = port
  }

  override setupMethods(): void {
    this.server.addMethod('zeusConfig', (data) => {
      this.responses$$.next({
        action: 'zeusConfig',
        data,
      })
    })
  }
}

export const PortServerContext = React.createContext<PortServer | null>(null)

export function usePortServer() {
  const portServer = React.useContext(PortServerContext)

  if (portServer === null) {
    throw new Error('usePortServer must be used within a PortServerProvider')
  }

  return portServer
}
