import { CorpIndustryName } from '@ns'

export interface CalculateRawProductionOpts {
  /** Industry of the division to calculate production for. */
  industry: CorpIndustryName
  /** Comes from `ns.corporation.getOffice().employeeProductionByJob.Operations`. */
  operationsEmployeeProduction: number
  /** Comes from `ns.corporation.getOffice().employeeProductionByJob.Engineer`. */
  engineerEmployeeProduction: number
  /** Comes from `ns.corporation.getOffice().employeeProductionByJob.Management`. */
  managementEmployeeProduction: number
  /** Whether the industry makes products (true) or only materials (false). */
  makesProducts: boolean
  /** Division production multiplier from boost materials. */
  productionMultiplier: number
  /** Smart Factories upgrade level. */
  smartFactoryLevel: number
  /** Whether the "Drones - Assembly" research has been unlocked. */
  hasDronesAssembly: boolean
  /** Whether the "Self-Correcting Assemblers" research has been unlocked. */
  hasSelfCorrectingAssemblers: boolean
  /** Whether the "uPgrade: Fulcrum" research has been unlocked (products only). */
  hasUpgradeFulcrum: boolean
}

/**
 * Computes the division's raw production value.
 *
 * `RawProduction` is the product of four multipliers: office, division production,
 * upgrade, and research. It represents the division's per-cycle production capability
 * before warehouse space limits are applied.
 *
 * @param opts - Inputs from office stats, upgrade levels, and research flags.
 * @returns The raw production value for the division.
 */
export function calculateRawProduction(opts: CalculateRawProductionOpts): number {
  const officeMultiplier = calculateOfficeMultiplier(opts)
  const upgradeMultiplier = calculateUpgradeMultiplier(opts)
  const researchMultiplier = calculateResearchMultiplier(opts)

  return officeMultiplier * opts.productionMultiplier * upgradeMultiplier * researchMultiplier
}

/**
 * Computes the office multiplier from employee production stats.
 *
 * @param opts - Employee production values and whether the industry makes products.
 * @returns The office multiplier component of `RawProduction`.
 */
function calculateOfficeMultiplier(opts: CalculateRawProductionOpts): number {
  const { engineerEmployeeProduction, managementEmployeeProduction, operationsEmployeeProduction, makesProducts } = opts

  const totalEmployeeProduction =
    engineerEmployeeProduction + managementEmployeeProduction + operationsEmployeeProduction

  if (totalEmployeeProduction === 0) return 0

  const managementFactor = 1 + managementEmployeeProduction / (1.2 * totalEmployeeProduction)

  const employeeProductionMultiplier =
    (operationsEmployeeProduction ** 0.4 + engineerEmployeeProduction ** 0.3) * managementFactor

  const balancingMultiplier = 0.05

  return makesProducts
    ? 0.5 * balancingMultiplier * employeeProductionMultiplier
    : balancingMultiplier * employeeProductionMultiplier
}

/**
 * Computes the Smart Factories upgrade multiplier.
 *
 * @param opts - Smart Factories upgrade level.
 * @returns The upgrade multiplier component of `RawProduction`.
 */
function calculateUpgradeMultiplier(opts: CalculateRawProductionOpts): number {
  return 1 + 0.03 * opts.smartFactoryLevel
}

/**
 * Computes the combined research multiplier from applicable researches.
 *
 * @param opts - Research flags and whether the industry makes products.
 * @returns The research multiplier component of `RawProduction`.
 */
function calculateResearchMultiplier(opts: CalculateRawProductionOpts): number {
  const { hasDronesAssembly, hasSelfCorrectingAssemblers, hasUpgradeFulcrum, makesProducts } = opts

  let multiplier = 1

  if (hasDronesAssembly) multiplier *= 1.2
  if (hasSelfCorrectingAssemblers) multiplier *= 1.1
  if (makesProducts && hasUpgradeFulcrum) multiplier *= 1.05

  return multiplier
}
