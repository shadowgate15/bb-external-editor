import { NSChannel } from '@/lib/channel'

class Client extends NSChannel<
  {
    [key: string]: () => void
  },
  {
    [key: string]: () => void
  }
> {
  constructor(ns: NS, from: number, to: number) {
    super(ns, from, to)
  }
}

export async function main(ns: NS) {
  ns.disableLog('ALL')
  ns.ui.openTail()
  await ns.sleep(100)

  const client = new Client(ns, 1, 2)

  setTimeout(() => {
    ns.print('Closing channel...')
    client.close()
  }, 1000)

  await client.listen()

  ns.print('Channel closed, exiting script...')
}
