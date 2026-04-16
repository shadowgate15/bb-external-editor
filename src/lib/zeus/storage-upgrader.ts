import 'reflect-metadata'

import { CityName } from '@ns'
import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../ns.identifier'

/**
 * Price multiplier applied per level for corporation-wide upgrades (Smart Storage, Smart Factories).
 * Each successive level costs 6% more than the previous.
 */
export const CORP_UPGRADE_PRICE_MULT = 1.06

/**
 * Price multiplier applied per level for per-warehouse upgrades.
 * Each successive level costs 7% more than the previous.
 */
export const WAREHOUSE_UPGRADE_PRICE_MULT = 1.07

/**
 * Input for {@link computeUpgradePlan}.
 *
 * All costs should reflect the current next-level price as returned by the
 * game's API (e.g. `ns.corporation.getUpgradeLevelCost` /
 * `ns.corporation.getUpgradeWarehouseCost`). Future level costs are derived
 * from these using the known geometric price multipliers.
 */
export interface StorageUpgradeInput {
  /** Total funds available to spend. */
  budget: number
  /** Cost of the next Smart Storage level (`getUpgradeLevelCost('Smart Storage')`). */
  currentSmartStorageCost: number
  /** Cost of the next Smart Factories level (`getUpgradeLevelCost('Smart Factories')`). */
  currentSmartFactoriesCost: number
  /** Whether to include Smart Factories levels in the purchase plan. */
  includeSmartFactories: boolean
  /**
   * Map of city name to the cost of the next warehouse upgrade level for that
   * city (`getUpgradeWarehouseCost(divisionName, cityName, 1)`).
   */
  cityWarehouseCosts: Record<string, number>
}

/**
 * Result of {@link computeUpgradePlan}.
 *
 * Describes how many levels of each upgrade to purchase and the total cost.
 */
export interface StorageUpgradePlan {
  /** Number of Smart Storage levels to buy. */
  smartStorageLevels: number
  /** Number of Smart Factories levels to buy. */
  smartFactoriesLevels: number
  /** Map of city name to number of warehouse upgrade levels to buy for that city. */
  warehouseLevels: Record<string, number>
  /** Total funds consumed by the plan. */
  totalCost: number
}

/**
 * Compute the optimal one-off upgrade purchase plan for a given budget.
 *
 * Uses a greedy algorithm: at each step, buy the cheapest available next
 * upgrade level across all eligible upgrade types. Repeat until the budget
 * is exhausted. This maximises the total number of upgrade levels purchased
 * per dollar without requiring a common benefit unit across upgrade types.
 *
 * Future upgrade costs are modelled as `currentCost × priceMult^k` where
 * `k` is the number of additional levels already virtually purchased. The
 * multipliers are {@link CORP_UPGRADE_PRICE_MULT} (1.06) for Smart Storage
 * and Smart Factories, and {@link WAREHOUSE_UPGRADE_PRICE_MULT} (1.07) for
 * per-warehouse upgrades.
 *
 * @param input - Current state and budget constraints.
 * @returns A plan describing how many levels of each upgrade to buy.
 */
export function computeUpgradePlan(input: StorageUpgradeInput): StorageUpgradePlan {
  const { budget, currentSmartStorageCost, currentSmartFactoriesCost, includeSmartFactories, cityWarehouseCosts } =
    input

  // Virtual costs track the cost of the NEXT purchase for each upgrade slot.
  // They advance by the geometric multiplier each time a level is bought.
  const virtualCosts: Record<string, number> = {
    'smart-storage': currentSmartStorageCost,
  }

  if (includeSmartFactories) {
    virtualCosts['smart-factories'] = currentSmartFactoriesCost
  }

  for (const [city, cost] of Object.entries(cityWarehouseCosts)) {
    virtualCosts[`warehouse-${city}`] = cost
  }

  // Initialise plan with zero purchases for all cities
  const warehouseLevels: Record<string, number> = Object.fromEntries(
    Object.keys(cityWarehouseCosts).map((city) => [city, 0]),
  )
  const plan: StorageUpgradePlan = {
    smartStorageLevels: 0,
    smartFactoriesLevels: 0,
    warehouseLevels,
    totalCost: 0,
  }

  let remaining = budget

  while (true) {
    // Find the candidate with the lowest next-level cost
    let cheapestKey: string | null = null
    let cheapestCost = Infinity

    for (const [key, cost] of Object.entries(virtualCosts)) {
      if (cost < cheapestCost) {
        cheapestCost = cost
        cheapestKey = key
      }
    }

    if (cheapestKey === null || cheapestCost > remaining) {
      break
    }

    // Record the purchase and advance this upgrade's virtual cost by one level
    remaining -= cheapestCost
    plan.totalCost += cheapestCost

    if (cheapestKey === 'smart-storage') {
      plan.smartStorageLevels++
      virtualCosts['smart-storage'] = cheapestCost * CORP_UPGRADE_PRICE_MULT
    } else if (cheapestKey === 'smart-factories') {
      plan.smartFactoriesLevels++
      virtualCosts['smart-factories'] = cheapestCost * CORP_UPGRADE_PRICE_MULT
    } else {
      // cheapestKey is 'warehouse-<city>'
      const city = cheapestKey.slice('warehouse-'.length)
      plan.warehouseLevels[city]++
      virtualCosts[cheapestKey] = cheapestCost * WAREHOUSE_UPGRADE_PRICE_MULT
    }
  }

  return plan
}

/**
 * Injectable service that executes an optimal one-off storage and production
 * upgrade purchase against the current corporation funds.
 *
 * Wraps {@link computeUpgradePlan} and applies the resulting plan immediately
 * via the Bitburner NS corporation API.
 */
@injectable('Singleton')
export class StorageUpgrader {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {}

  /**
   * Compute and immediately execute the optimal upgrade plan for the given
   * division using all currently available corporation funds.
   *
   * @param divisionName - The division whose warehouse upgrades should be included.
   * @param includeSmartFactories - When `true`, Smart Factories levels compete
   *   alongside storage upgrades in the greedy allocation.
   * @returns The executed {@link StorageUpgradePlan} (levels bought and total cost).
   */
  upgradeStorage(divisionName: string, includeSmartFactories: boolean): StorageUpgradePlan {
    const funds = this.ns.corporation.getCorporation().funds
    const division = this.ns.corporation.getDivision(divisionName)

    const cityWarehouseCosts = Object.fromEntries(
      division.cities.map((city) => [city, this.ns.corporation.getUpgradeWarehouseCost(divisionName, city, 1)]),
    )

    const plan = computeUpgradePlan({
      budget: funds,
      currentSmartStorageCost: this.ns.corporation.getUpgradeLevelCost('Smart Storage'),
      currentSmartFactoriesCost: this.ns.corporation.getUpgradeLevelCost('Smart Factories'),
      includeSmartFactories,
      cityWarehouseCosts,
    })

    // levelUpgrade does not support bulk purchasing — loop once per level
    for (let i = 0; i < plan.smartStorageLevels; i++) {
      this.ns.corporation.levelUpgrade('Smart Storage')
    }
    for (let i = 0; i < plan.smartFactoriesLevels; i++) {
      this.ns.corporation.levelUpgrade('Smart Factories')
    }

    // upgradeWarehouse accepts an `amt` argument — batch each city in one call
    for (const [city, levels] of Object.entries(plan.warehouseLevels) as [CityName, number][]) {
      if (levels > 0) {
        this.ns.corporation.upgradeWarehouse(divisionName, city, levels)
      }
    }

    return plan
  }
}
