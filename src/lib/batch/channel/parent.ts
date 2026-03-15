import { Subject } from 'rxjs'
import z from 'zod'

import { NSChannel } from '@/lib/channel'
import { randomNumber } from '@/lib/utils/random-number'
import { zodFilter } from '@/lib/utils/zod-filter'

import { ChildChannelMethods, ParentChannelMethods } from './shared'

const errorEvent = z.object({
  type: z.literal('error'),
  error: z.unknown(),
})
export const errorEventFilter = zodFilter(errorEvent)

const readyEvent = z.object({
  type: z.literal('ready'),
  threads: z.number(),
})
export const readyEventFilter = zodFilter(readyEvent)

const startTimeEvent = z.object({
  type: z.literal('startTime'),
  startTime: z.number(),
})
export const startTimeEventFilter = zodFilter(startTimeEvent)

const pongEvent = z.object({
  type: z.literal('pong'),
  id: z.string(),
})
export const pongEventFilter = zodFilter(pongEvent)

const _eventMap = z.discriminatedUnion('type', [errorEvent, readyEvent, startTimeEvent, pongEvent])
export type ParentChannelEventMap = z.infer<typeof _eventMap>

export type ParentChannelSubject = Subject<ParentChannelEventMap>

export class ParentChannel extends NSChannel<ParentChannelMethods, ChildChannelMethods> {
  constructor(
    ns: NS,
    from: number,
    to: number,
    protected readonly subject: ParentChannelSubject,
    protected readonly delay: number,
  ) {
    super(ns, from, to)

    this.subject.pipe(startTimeEventFilter).subscribe(({ startTime }) => {
      if (this.abortController.signal.aborted) return

      this.send('startTime', startTime + this.delay)
    })
  }

  override setupMethods() {
    this.server.addMethod('error', async (error) => {
      this.ns.print(`ERROR Worker ${this.to} failed with error: ${error}`)

      this.subject.next({
        type: 'error',
        error: error,
      })
    })

    this.server.addMethod('complete', async () => {
      this.close()
    })

    this.server.addMethod('pong', async (id) => {
      this.subject.next({ type: 'pong', id })
    })
  }
}

export function createParentChannel(
  ns: NS,
  subject: ParentChannelSubject,
  delay: number,
  parent: number,
  child: number,
): ParentChannel {
  return new ParentChannel(ns, parent, child, subject, delay)
}
