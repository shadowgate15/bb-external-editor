import { Nuker } from '@/lib/utils/nuker'
import { ScriptAbortController } from '@/lib/utils/script-abort-controller'
import { ServerList } from '@/lib/utils/server-list'

export async function main(ns: NS) {
  ns.ui.openTail()

  const abortController = new ScriptAbortController()
  const serverList = new ServerList(ns, new Nuker(ns), abortController)

  const servers = serverList.getAll()

  for (const server of servers) {
    ns.ls(server, 'SphyxOS').forEach((file) => {
      ns.rm(file, server)
    })
  }

  abortController.abort()
}
