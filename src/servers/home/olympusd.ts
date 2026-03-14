import 'reflect-metadata'

import { Container } from 'inversify'

import { buildBatchModule } from '@/lib/batch'
import { BatchManager } from '@/lib/batch/manager'
import { NSIdentifier } from '@/lib/ns.identifier'
import { ScriptAbortController } from '@/lib/utils/script-abort-controller'

export async function main(ns: NS) {
  ns.disableLog('ALL')
  ns.ui.openTail()
  await ns.sleep(100)

  const container = new Container()

  container.bind<NS>(NSIdentifier).toConstantValue(ns)

  await container.load(buildBatchModule(container))

  const batchManager = container.get<BatchManager>(BatchManager)

  ns.atExit(() => {
    container.get<ScriptAbortController>(ScriptAbortController).abort()
  }, crypto.randomUUID())

  await batchManager.start()
}
