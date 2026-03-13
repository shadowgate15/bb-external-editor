import { NSChannel } from '@/lib/channel'

import type { ChildChannelMethods, ParentChannelMethods } from './shared'

export abstract class ChildChannel extends NSChannel<ChildChannelMethods, ParentChannelMethods> {
  constructor(
    ns: NS,
    from: number,
    to: number,
    protected readonly target: string,
  ) {
    super(ns, from, to)

    this.ns.atExit(() => {
      this.send('complete')
    }, crypto.randomUUID())

    this.server.addMethod('startTime', async (startTime) => {
      ns.print(
        `INFO [${new Date().toLocaleString()}] Worker ${this.to} starting at time ${new Date(startTime).toLocaleString()}`,
      )

      await this.process(startTime)
        .then(() => {
          ns.print(`SUCCESS [${new Date().toLocaleString()}] Worker ${this.to} complete`)
        })
        .catch((error) => {
          this.send('error', error)
        })
        .finally(() => {
          this.close()
        })
    })

    this.server.addMethod('ping', async (id) => {
      ns.print(`INFO [${new Date().toLocaleString()}] Worker ${this.to} received ping with id ${id}`)
      this.send('pong', id)
    })
  }

  override async preListen() {
    this.ns.print(`INFO [${new Date().toLocaleString()}] Worker ${this.to} is ready`)
  }

  protected calculateDelay(startTime: number) {
    const now = Date.now()

    const delay = startTime - now

    return delay
  }

  abstract process(startTime: number): Promise<void>
}
