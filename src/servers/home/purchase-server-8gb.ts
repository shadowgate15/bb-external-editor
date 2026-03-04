import { NS } from '@ns'
import padStart from 'lodash/padStart'

export async function main(ns: NS) {
  // How much RAM each purchased server will have. In this case, it'll
  // be 8GB.
  const ram = 8

  // Iterator we'll use for our loop
  let i = (ns.args[0] as number) || 0

  // Continuously try to purchase servers until we've reached the maximum
  // amount of servers
  while (i < ns.getPurchasedServerLimit()) {
    // Check if we have enough money to purchase a server
    if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
      // If we have enough money, then:
      //  1. Purchase the server
      //  2. Increment our iterator to indicate that we've bought a new server
      ns.purchaseServer('pserv-' + padStart(i.toString(), 2, '0'), ram)
      ++i
    }
    //Make the script wait for a second before looping again.
    //Removing this line will cause an infinite loop and crash the game.
    await ns.asleep(1000)
  }

  ns.alert('Purchased maximum number of servers with ' + ram + 'GB of RAM!')
}
