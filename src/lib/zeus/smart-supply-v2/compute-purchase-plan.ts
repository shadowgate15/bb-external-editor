export interface ComputePurchasePlanOpts {
  /** Raw production value (from `getLimitedRawProduction`) for this division/city. */
  totalRawProduction: number
  /**
   * Input material coefficients keyed by material name.
   * From `ns.corporation.getIndustryData(divisionType).requiredMaterials`.
   */
  requiredMaterials: Record<string, number>
  /**
   * Material size constants keyed by material name.
   * From `ns.corporation.getMaterialData()`.
   */
  materialSizes: Record<string, { size: number }>
  /** Available warehouse free space (`warehouse.size - warehouse.sizeUsed`). */
  warehouseFreeSpace: number
  /** Currently stored amounts of each input material in the warehouse. */
  inventory: Record<string, number>
}

/** Amount to buy for each input material, keyed by material name. */
export type PurchasePlan = Record<string, number>

/**
 * Computes the amount of each input material to purchase this cycle.
 *
 * Implements the smart-supply buying algorithm:
 * 1. Compute required amount per material: `coeff * TotalRawProduction`.
 * 2. Find the limiting run count: `worseAmt = min(required / coeff)` (= TRP).
 * 3. Align all materials to the limiting count: `aligned = worseAmt * coeff`.
 * 4. Sum total storage needed: `sum(aligned * materialSize)`.
 * 5. If total storage exceeds free space, apply `multiplier = freeSpace / totalSize`.
 * 6. Final amount: `max(aligned * multiplier - stored, 0)`.
 *
 * @param opts - TRP, industry coefficients, material sizes, free space, and current inventory.
 * @returns A record of how many units of each input material to buy.
 */
export function computePurchasePlan(opts: ComputePurchasePlanOpts): PurchasePlan {
  const { totalRawProduction, requiredMaterials, materialSizes, warehouseFreeSpace, inventory } = opts

  const entries = Object.entries(requiredMaterials)

  if (entries.length === 0) return {}

  // Step 1: required_i = coeff_i * TRP
  const required = entries.map(([materialName, coeff]) => ({
    materialName,
    coeff,
    required: coeff * totalRawProduction,
  }))

  // Step 2: worseAmt = min(required_i / coeff_i)
  const worseAmt = Math.min(...required.map(({ required, coeff }) => required / coeff))

  // Step 3: aligned_i = worseAmt * coeff_i
  const aligned = required.map(({ materialName, coeff }) => ({
    materialName,
    aligned: worseAmt * coeff,
  }))

  // Step 4: totalSize = sum(aligned_i * materialSize_i)
  const totalSize = aligned.reduce((sum, { materialName, aligned: amt }) => {
    const size = materialSizes[materialName]?.size ?? 1
    return sum + amt * size
  }, 0)

  // Step 5: scale down if over capacity
  const multiplier = totalSize > warehouseFreeSpace ? warehouseFreeSpace / totalSize : 1

  // Step 6: finalAmt_i = max(aligned_i * multiplier - stored_i, 0)
  const plan: PurchasePlan = {}

  for (const { materialName, aligned: amt } of aligned) {
    const stored = inventory[materialName] ?? 0
    plan[materialName] = Math.max(amt * multiplier - stored, 0)
  }

  return plan
}
