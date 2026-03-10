import z from 'zod'

import { ChildChannel } from '@/lib/batch/channel/child'

const flagsSchema = z.object({
  target: z.string(),
  from: z.number().positive(),
  to: z.number().positive(),
})

export async function main(ns: NS) {
  const flags = flagsSchema.parse(
    ns.flags([
      ['target', ''],
      ['from', 0],
      ['to', 0],
    ]),
  )

  await new Channel(ns, flags.from, flags.to, flags.target).listen()
}

class Channel extends ChildChannel {
  override async process(startTime: number) {
    await this.ns.hack(this.target, {
      additionalMsec: this.calculateDelay(startTime),
    })
  }
}
