import { Subject } from 'rxjs'
import z from 'zod'

import { NSChannel } from '@/lib/channel'
import { randomNumber } from '@/lib/utils/random-number'
import { zodFilter } from '@/lib/utils/zod-filter'

import { ChildChannelMethods, ParentChannelMethods } from './shared'

const errorEvent = z.object({
  type: z.literal('error'),
  error: z.unknown(),
  id: z.string(),
})
export const errorEventFilter = zodFilter(errorEvent)

const readyEvent = z.object({
  type: z.literal('ready'),
  id: z.string(),
})
export const readyEventFilter = zodFilter(readyEvent)

const startTimeEvent = z.object({
  type: z.literal('startTime'),
  startTime: z.number(),
})
export const startTimeEventFilter = zodFilter(startTimeEvent)

const _eventMap = z.discriminatedUnion('type', [errorEvent, readyEvent, startTimeEvent])
export type ParentChannelEventMap = z.infer<typeof _eventMap>

export type ParentChannelSubject = Subject<ParentChannelEventMap>

export class ParentChannel extends NSChannel<ParentChannelMethods, ChildChannelMethods> {
  constructor(
    ns: NS,
    from: number,
    to: number,
    protected readonly subject: ParentChannelSubject,
    protected readonly delay: number,
    protected readonly allocationId: string,
  ) {
    super(ns, from, to)
  }

  override setupMethods() {
    this.server.addMethod('ready', async () => {
      this.subject.pipe(startTimeEventFilter).subscribe(({ startTime }) => {
        if (this.abortController.signal.aborted) return

        this.send('startTime', startTime + this.delay)
      })

      this.subject.next({
        type: 'ready',
        id: this.allocationId,
      })
    })

    this.server.addMethod('error', async (error) => {
      this.ns.print(`ERROR Worker ${this.to} failed with error: ${error}`)

      this.subject.next({
        type: 'error',
        error: error,
        id: this.allocationId,
      })
    })

    this.server.addMethod('complete', async () => {
      this.close()
    })
  }
}

export function createParentChannel(
  ns: NS,
  subject: ParentChannelSubject,
  delay: number,
  allocationId: string,
): [channel: ParentChannel, parent: number, child: number] {
  const parent = randomNumber()
  const child = randomNumber()

  return [new ParentChannel(ns, parent, child, subject, delay, allocationId), parent, child]
}
