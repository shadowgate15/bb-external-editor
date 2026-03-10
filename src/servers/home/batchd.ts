import 'reflect-metadata'

import { once } from 'node:events'

import { buildProviderModule } from '@inversifyjs/binding-decorators'
import { Container } from 'inversify'

import { BatchManager } from '@/lib/batch/manager'
import { NSIdentifier } from '@/lib/ns.identifier'
import { ScriptAbortController } from '@/lib/utils/script-abort-controller'

export async function main(ns: NS) {
  ns.disableLog('ALL')
  ns.ui.openTail()
  await ns.sleep(100)

  const container = new Container()

  container.bind<NS>(NSIdentifier).toConstantValue(ns)

  await container.load(buildProviderModule())

  const batchManager = container.get<BatchManager>(BatchManager)

  ns.atExit(() => {
    container.get<ScriptAbortController>(ScriptAbortController).abort()
  }, crypto.randomUUID())

  await once(batchManager, 'finished')
}
