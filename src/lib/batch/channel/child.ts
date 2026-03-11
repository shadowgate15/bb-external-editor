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
      ns.print(`INFO Worker ${this.to} starting at time ${new Date(startTime).toLocaleString()}`)

      await this.process(startTime)
        .then(() => {
          ns.print(`SUCCESS Worker ${this.to} complete`)
        })
        .catch((error) => {
          this.send('error', error)
        })
        .finally(() => {
          this.close()
        })
    })
  }

  override async preListen() {
    this.ns.print(`INFO Worker ${this.to} is ready`)
    this.send('ready')
  }

  protected calculateDelay(startTime: number) {
    const now = Date.now()

    const delay = startTime - now

    return delay
  }

  abstract process(startTime: number): Promise<void>
}
