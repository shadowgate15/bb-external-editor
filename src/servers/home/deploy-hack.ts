import { NS } from '@ns'
import { getTargetServer } from './deploy/get-target-server'
import { nuke } from './deploy/nuke'
import { ServerList } from './deploy/server-list'

const SCRIPT_NAME = 'hack.js'

export async function main(ns: NS) {
  const servers = ServerList.get(ns)
  const targetServer = getTargetServer(ns, servers)

  ns.tprint(
    `Deploying "${SCRIPT_NAME}" targeting: "${targetServer}" to ${servers.length} servers: ${servers.join(', ')}`,
  )

  for (const server of servers) {
    const threadCount = getThreadCount(ns, server)

    if (threadCount <= 0) {
      ns.print(
        `WARN: Not enough RAM to deploy ${SCRIPT_NAME} to ${server} (requires ${ns.formatRam(
          SCRIPT_RAM as number,
        )}, has ${ns.formatRam(ns.getServerMaxRam(server))})`,
      )
      continue
    }

    ns.print(`Deploying ${SCRIPT_NAME} to ${server} with ${threadCount} threads...`)

    ns.scp(SCRIPT_NAME, server)

    nuke(ns, server)

    ns.kill(SCRIPT_NAME, server, targetServer)
    ns.exec(SCRIPT_NAME, server, threadCount, targetServer)
    ns.print(`Deployed ${SCRIPT_NAME} to ${server} with ${threadCount} threads!`)
  }
}

let SCRIPT_RAM: number | null = null
function getThreadCount(ns: NS, server: string): number {
  if (!SCRIPT_RAM) {
    SCRIPT_RAM = ns.getScriptRam(SCRIPT_NAME)
    ns.print(`INFO: ${SCRIPT_NAME} requires ${ns.formatRam(SCRIPT_RAM)} of RAM`)
  }

  const maxRam = ns.getServerMaxRam(server)

  return Math.floor(maxRam / SCRIPT_RAM)
}
