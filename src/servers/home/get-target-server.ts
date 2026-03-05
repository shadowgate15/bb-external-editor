import { NS } from '@ns'
import { serversWithScoreAbove } from './deploy/get-target-server'
import { ServerList } from './deploy/server-list'

export async function main(ns: NS) {
  const servers = ServerList.get(ns)

  for (const [server, score] of serversWithScoreAbove(ns, servers)
    .filter(([_, score]) => score)
    .reverse()) {
    ns.tprint(`${server}: ${score.toFixed(2)} - Money: ${ns.formatNumber(ns.getServerMaxMoney(server), 2)}`)
  }
}
