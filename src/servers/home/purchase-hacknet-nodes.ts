import { NS } from '@ns'

export async function main(ns: NS) {
  while (true) {
    if (ns.hacknet.purchaseNode() === -1) {
      let cheapestUpgrade: { index: number; upgrade: Upgrade } | null = null
      let cheapestUpgradeCost = Infinity

      // This is used to do multiple purchases in a row if the player has enough money to do so. For example,
      // if the player has enough money to buy 2 levels for a node,
      // it will do so in one go instead of buying 1 level and then checking again if it can buy another level.
      let purchaseMade = true

      while (purchaseMade) {
        purchaseMade = false

        for (let i = 0; i < ns.hacknet.numNodes(); i++) {
          if (ns.hacknet.getCoreUpgradeCost(i) < cheapestUpgradeCost) {
            cheapestUpgrade = { index: i, upgrade: Upgrade.Core }
            cheapestUpgradeCost = ns.hacknet.getCoreUpgradeCost(i)
          }

          if (ns.hacknet.getRamUpgradeCost(i) < cheapestUpgradeCost) {
            cheapestUpgrade = { index: i, upgrade: Upgrade.Ram }
            cheapestUpgradeCost = ns.hacknet.getRamUpgradeCost(i)
          }

          if (ns.hacknet.getLevelUpgradeCost(i) < cheapestUpgradeCost) {
            cheapestUpgrade = { index: i, upgrade: Upgrade.Level }
            cheapestUpgradeCost = ns.hacknet.getLevelUpgradeCost(i)
          }
        }

        if (cheapestUpgrade) {
          switch (cheapestUpgrade.upgrade) {
            case Upgrade.Core: {
              purchaseMade = ns.hacknet.upgradeCore(cheapestUpgrade.index)

              break
            }
            case Upgrade.Ram: {
              purchaseMade = ns.hacknet.upgradeRam(cheapestUpgrade.index)

              break
            }
            case Upgrade.Level: {
              purchaseMade = ns.hacknet.upgradeLevel(cheapestUpgrade.index)

              break
            }
          }
        }

        cheapestUpgrade = null
        cheapestUpgradeCost = Infinity

        await ns.asleep(100)
      }
    }

    await ns.asleep(1000)
  }
}

enum Upgrade {
  Core,
  Ram,
  Level,
}
