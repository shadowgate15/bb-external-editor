import { NS } from '@ns'

export async function main(ns: NS) {
  ns.disableLog('ALL')

  let factor = 1

  // The RAM threshold to upgrade servers to

  while (factor <= 20) {
    const ram = 2 ** factor

    const serversToUpgrade = getServersToUpgrade(ns, ram)

    for (const server of serversToUpgrade) {
      while (ns.getServerMoneyAvailable('home') < ns.getPurchasedServerUpgradeCost(server, ram)) {
        await ns.asleep(1000)
      }

      // Upgreade the server to the new RAM amount
      if (ns.upgradePurchasedServer(server, ram)) {
        ns.print(`Upgraded ${server} to ${ns.formatRam(ram)}`)
      }
    }

    ns.toast(`Servers have been upgraded to ${ns.formatRam(ram)}!`)
    factor++
  }

  ns.alert('All server have been upgraded!')
}

function getServersToUpgrade(ns: NS, minRam: number): string[] {
  const servers = ns.getPurchasedServers()

  return servers.filter((server) => ns.getServerMaxRam(server) <= minRam)
}
