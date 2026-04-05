import { CorpIndustryName } from '@ns'

export interface CalculateRawProductionOpts {
  /** Industry of the division to calculate production for. */
  industry: CorpIndustryName
  /** Comes from ns.corporation.getOffice().employeeProductionByJob.Operations */
  operationsEmployeeProduction: number
  /** Comes from ns.corporation.getOffice().employeeProductionByJob.Engineer */
  engineerEmployeeProduction: number
  /** Comes from ns.corporation.getOffice().employeeProductionByJob.Management */
  managementEmployeeProduction: number
  /** Whether the industry makes products */
  makesProducts: boolean
  /** Smart Factory level */
  smartFactoryLevel: number
  /** Whether the "Drones -- Assembly" research has been researched */
  hasDronesAssembly: boolean
  /** Whether the "Self-Correcting Assemblers" research has been researched */
  hasSelfCorrectingAssemblers: boolean
  /** Wthether the "uPgrade: Fulcrum" research has been researched */
  hasUpgradeFulcrum: boolean
  productionMultiplier: number
}

export function calculateRawProduction(opts: CalculateRawProductionOpts): number {
  const officeMultiplier = caclulateOfficeMultiplier(opts)

  const upgradeMultiplier = caclulateUpgradeMultiplier(opts)

  const researchMultiplier = calculateResearchMultiplier(opts)

  const rawProduction = officeMultiplier * opts.productionMultiplier * upgradeMultiplier * researchMultiplier

  return rawProduction
}

function caclulateOfficeMultiplier(opts: CalculateRawProductionOpts) {
  const { engineerEmployeeProduction, managementEmployeeProduction, operationsEmployeeProduction, makesProducts } = opts

  const totalEmployeeProduction =
    engineerEmployeeProduction + managementEmployeeProduction + operationsEmployeeProduction

  const managementFactor = 1 + managementEmployeeProduction / (1.2 * totalEmployeeProduction)

  const employeeProductionMultiplier =
    (operationsEmployeeProduction ** 0.4 + engineerEmployeeProduction ** 0.3) * managementFactor

  const balancingMultiplier = 0.05

  const officeMultiplier = makesProducts
    ? 0.5 * balancingMultiplier * employeeProductionMultiplier
    : balancingMultiplier * employeeProductionMultiplier

  return officeMultiplier
}

function caclulateUpgradeMultiplier(opts: CalculateRawProductionOpts) {
  const { smartFactoryLevel } = opts

  const upgradeMutliplier = 1 + 0.03 * smartFactoryLevel

  return upgradeMutliplier
}

function calculateResearchMultiplier(opts: CalculateRawProductionOpts) {
  const { hasDronesAssembly, hasSelfCorrectingAssemblers, hasUpgradeFulcrum, makesProducts } = opts

  let productionMultiplier = 1

  if (hasDronesAssembly) {
    productionMultiplier *= 1.2
  }

  if (hasSelfCorrectingAssemblers) {
    productionMultiplier *= 1.1
  }

  if (makesProducts && hasUpgradeFulcrum) {
    productionMultiplier *= 1.05
  }

  return productionMultiplier
}
