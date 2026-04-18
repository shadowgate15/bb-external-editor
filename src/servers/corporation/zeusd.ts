import { Container } from 'inversify'

import { NSIdentifier } from '@/lib/ns.identifier'
import { zeusModule } from '@/lib/zeus'
import { App } from '@/lib/zeus/app'
import { CorporationDaemonServer } from '@/lib/zeus/daemon/server'

export async function main(ns: NS) {
  ns.disableLog('ALL')
  // ns.ui.openTail()
  // await ns.asleep(0)

  ns.print('INFO Starting zeusd...')

  const container = new Container()

  container.bind(NSIdentifier).toConstantValue(ns)

  await container.load(zeusModule)

  // This guarantees that the server is listening before the app starts running, so we don't miss any updates
  container.get(CorporationDaemonServer).listen()

  await container.get(App).run()
}
