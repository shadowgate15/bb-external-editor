import { CityName, NS } from '@ns'

import { assertIsString } from '@/lib/assert/is-string'
import { computeUpgradePlan } from '@/lib/zeus/storage-upgrader'

export async function main(ns: NS) {
  const divisionName = assertIsString(ns.args[0], 'Division name is required as the first argument')
  const { 'smart-factories': includeSmartFactories } = ns.flags([['smart-factories', false]]) as {
    'smart-factories': boolean
  }

  const funds = ns.corporation.getCorporation().funds
  const division = ns.corporation.getDivision(divisionName)

  const currentSmartStorageCost = ns.corporation.getUpgradeLevelCost('Smart Storage')
  const currentSmartFactoriesCost = ns.corporation.getUpgradeLevelCost('Smart Factories')

  const cityWarehouseCosts = Object.fromEntries(
    division.cities.map((city) => [city, ns.corporation.getUpgradeWarehouseCost(divisionName, city, 1)]),
  )

  const plan = computeUpgradePlan({
    budget: funds,
    currentSmartStorageCost,
    currentSmartFactoriesCost,
    includeSmartFactories,
    cityWarehouseCosts,
  })

  if (plan.totalCost === 0) {
    ns.print('INFO No upgrades affordable with current funds.')
    ns.toast('No upgrades affordable.', 'warning')
    return
  }

  // Execute Smart Storage purchases (one call per level — API does not support bulk)
  for (let i = 0; i < plan.smartStorageLevels; i++) {
    ns.corporation.levelUpgrade('Smart Storage')
  }

  // Execute Smart Factories purchases (one call per level)
  for (let i = 0; i < plan.smartFactoriesLevels; i++) {
    ns.corporation.levelUpgrade('Smart Factories')
  }

  // Execute warehouse upgrades per city in a single batched call each
  for (const [city, levels] of Object.entries(plan.warehouseLevels) as [CityName, number][]) {
    if (levels > 0) {
      ns.corporation.upgradeWarehouse(divisionName, city, levels)
    }
  }

  // Build summary line
  const parts: string[] = []
  if (plan.smartStorageLevels > 0) parts.push(`Smart Storage ×${plan.smartStorageLevels}`)
  if (plan.smartFactoriesLevels > 0) parts.push(`Smart Factories ×${plan.smartFactoriesLevels}`)
  for (const [city, levels] of Object.entries(plan.warehouseLevels)) {
    if (levels > 0) parts.push(`${city} warehouse ×${levels}`)
  }

  const summary = parts.join(', ')
  const costStr = ns.formatNumber(plan.totalCost)

  ns.print(`SUCCESS Purchased: ${summary} for $${costStr}`)
  ns.toast(`Upgrades purchased for ${divisionName}: ${summary}`, 'success')
}
