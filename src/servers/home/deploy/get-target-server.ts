import { NS } from '@ns'

export function getTargetServer(ns: NS, servers: string[]): string {
  const orderedServers = serversOrderedByScore(ns, servers)

  return orderedServers[0]
}

export function serversOrderedByScore(ns: NS, servers: string[]): string[] {
  return servers
    .filter((s) => {
      // This way if our hacking level is 1, we can still hack servers that require a hacking level of 1
      let hackingLevel = ns.getHackingLevel()

      if (hackingLevel !== 1) {
        hackingLevel = hackingLevel / 2
      }

      return ns.getServerRequiredHackingLevel(s) <= hackingLevel
    })
    .sort((a, b) => {
      return scoreServer(ns, b) - scoreServer(ns, a)
    })
}

export function serversWithScoreAbove(ns: NS, servers: string[]): [server: string, score: number][] {
  const orderedServers = serversOrderedByScore(ns, servers)

  return orderedServers.map((s) => [s, scoreServer(ns, s)])
}

function scoreServer(ns: NS, server: string): number {
  return ns.getServerMaxMoney(server) / ns.getServerMinSecurityLevel(server)
}
