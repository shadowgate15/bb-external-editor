import { NS } from '@ns'
import { getTargetServer } from './deploy/get-target-server'
import { ServerList } from './deploy/server-list'

export async function main(ns: NS) {
  const { home } = ns.flags([['home', false]])

  const servers = ServerList.get(ns)
  const target = getTargetServer(ns, servers)

  const args = ['--target', target]

  if (home) {
    args.push('--home')
  }

  ns.ui.openTail(ns.run('monitor-server.js', 1, target))
  ns.spawn('controller/main.js', { threads: 1, spawnDelay: 0 }, ...args)
}
