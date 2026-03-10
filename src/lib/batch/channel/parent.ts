import EventEmitter, { once } from 'node:events'

import { NSChannel } from '@/lib/channel'
import { randomNumber } from '@/lib/utils/random-number'

import { ChildChannelMethods, ParentChannelMethods } from './shared'

export interface ParentChannelEventMap {
  emit: [error: unknown, worker: number]
  ready: []
  startTime: [startTime: number]
}

export class ParentChannel extends NSChannel<ParentChannelMethods, ChildChannelMethods> {
  constructor(
    ns: NS,
    from: number,
    to: number,
    protected readonly emitter: EventEmitter<ParentChannelEventMap>,
    protected readonly delay: number,
  ) {
    super(ns, from, to)
  }

  override setupMethods() {
    this.server.addMethod('ready', async () => {
      once(this.emitter, 'startTime').then(([startTime]) => {
        if (this.abortController.signal.aborted) return

        this.send('startTime', startTime + this.delay)
      })

      this.emitter.emit('ready')
    })

    this.server.addMethod('error', async (error) => {
      this.ns.print(`ERROR Worker ${this.to} failed with error: ${error}`)

      this.emitter.emit('error', error, this.to)
    })

    this.server.addMethod('complete', async () => {
      this.close()
    })
  }
}

export function createParentChannel(
  ns: NS,
  emitter: EventEmitter<ParentChannelEventMap>,
  delay: number,
): [channel: ParentChannel, parent: number, child: number] {
  const parent = randomNumber()
  const child = randomNumber()

  return [new ParentChannel(ns, parent, child, emitter, delay), parent, child]
}
