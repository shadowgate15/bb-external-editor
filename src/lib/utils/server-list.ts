import 'reflect-metadata'

import { EventEmitter } from 'node:events'

import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../ns.identifier'
import { Nuker } from './nuker'
import { ScriptAbortController } from './script-abort-controller'

interface EventMap {
  serverAdded: []
  /** Pings every minute to check for new servers */
  servers: []
}

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class ServerList extends EventEmitter<EventMap> {
  private servers: Set<string> = new Set()

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Nuker)
    private readonly nuker: Nuker,

    @inject(ScriptAbortController)
    private readonly scriptAbortController: ScriptAbortController,
  ) {
    super()

    this.ns.print('INFO ServerList initialized')

    const interval = setInterval(() => {
      this._get()
      this.emit('servers')
    }, 1000 * 60)

    this.scriptAbortController.signal.addEventListener('abort', () => {
      clearInterval(interval)
    })
  }

  private _get() {
    let hasAddedServer = false
    const visited = new Set<string>()

    const serversToVisit = this.ns.scan('home')
    let server: string | undefined = serversToVisit.pop()

    while (server) {
      if (visited.has(server)) {
        server = serversToVisit.pop()
        continue
      }

      this.nuker.nuke(server)

      if (!this.servers.has(server)) {
        this.servers.add(server)

        hasAddedServer = true
      }

      serversToVisit.push(...this.ns.scan(server))

      visited.add(server)

      server = serversToVisit.pop()
    }

    if (hasAddedServer) {
      this.emit('serverAdded')
    }
  }

  getAll(): string[] {
    this._get()

    return Array.from(this.servers.values())
  }
}
