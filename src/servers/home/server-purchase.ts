import { NS } from '@ns'
import padStart from 'lodash/padStart'

const MAX_PREP_SERVERS = 12

let numOfPurchasedServers = 0

export async function main(ns: NS) {
  // How much RAM each purchased server will have. In this case, it'll
  // be 8GB.
  const ram = 8

  checkExistingServers(ns)

  // Continuously try to purchase servers until we've reached the maximum
  // amount of servers
  while (numOfPurchasedServers < ns.getPurchasedServerLimit()) {
    // Check if we have enough money to purchase a server
    if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
      // If we have enough money, then:
      //  1. Purchase the server
      //  2. Increment our iterator to indicate that we've bought a new server
      ns.purchaseServer(getServerName(), ram)
      ++numOfPurchasedServers
    }
    //Make the script wait for a second before looping again.
    //Removing this line will cause an infinite loop and crash the game.
    await ns.asleep(50)
  }

  ns.alert('Purchased maximum number of servers with ' + ram + 'GB of RAM!')
}

let hasCorporationServer = false
let prepServerIndex = 0
let pservIndex = 0

function getServerName() {
  if (!hasCorporationServer) {
    hasCorporationServer = true
    return 'corporation'
  }

  if (prepServerIndex < MAX_PREP_SERVERS) {
    const name = 'prep-' + padStart(prepServerIndex.toString(), 2, '0')
    prepServerIndex++

    return name
  }

  const name = 'pserv-' + padStart(pservIndex.toString(), 2, '0')
  pservIndex++

  return name
}
function checkExistingServers(ns: NS) {
  const purchasedServers = ns.getPurchasedServers()

  numOfPurchasedServers = purchasedServers.length - 1

  if (purchasedServers.includes('corporation')) {
    hasCorporationServer = true
  }

  const prepServers = purchasedServers.filter((server) => server.startsWith('prep-'))

  if (prepServers.length > 0) {
    prepServerIndex = parseInt(prepServers[prepServers.length - 1].split('-')[1])
  }

  const pservServers = purchasedServers.filter((server) => server.startsWith('pserv-'))

  if (pservServers.length > 0) {
    pservIndex = parseInt(pservServers[pservServers.length - 1].split('-')[1])
  }
}
