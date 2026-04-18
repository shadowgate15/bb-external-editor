import { Container } from 'inversify'

import { NSIdentifier } from '@/lib/ns.identifier'
import { Round2, zeusModule } from '@/lib/zeus'

export async function main(ns: NS) {
  ns.disableLog('sleep')
  ns.ui.openTail()
  await ns.sleep(100)

  const container = new Container()
  container.bind(NSIdentifier).toConstantValue(ns)
  await container.load(zeusModule)
  await container.get(Round2).run()
}
