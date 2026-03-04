import { NS } from '@ns'

export async function main(ns: NS) {
  ns.disableLog('ALL')

  // exponentiall factor to upgrade servers to
  const factor = ns.args[0]

  if (!factor || typeof factor !== 'number' || factor <= 1) {
    throw new Error('Please provide a valid factor (number greater than 1) as an argument')
  }

  if (factor > 20) {
    throw new Error('Factor is too high. Maximum allowed is 20 (1 TB of RAM).')
  }

  // The RAM threshold to upgrade servers to
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

  ns.alert(`Servers have been upgraded to ${ns.formatRam(ram)}!`)
}

function getServersToUpgrade(ns: NS, minRam: number): string[] {
  const servers = ns.getPurchasedServers()

  return servers.filter((server) => ns.getServerMaxRam(server) <= minRam)
}
