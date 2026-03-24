import { CorpIndustryName } from '@ns'

export interface Opts {
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
}

const DIVISION_RAW_PRODUCTION: Record<CorpIndustryName, number> = {
  Agriculture: 1,
  'Spring Water': 0,
  'Water Utilities': 0,
  Fishing: 0,
  Mining: 0,
  Refinery: 0,
  Restaurant: 0,
  Tobacco: 0,
  Chemical: 0,
  Pharmaceutical: 0,
  'Computer Hardware': 0,
  Robotics: 0,
  Software: 0,
  Healthcare: 0,
  'Real Estate': 0,
}

export function calculateRawProduction(opts: Opts): number {
  const officeMultiplier = caclulateOfficeMultiplier(opts)

  const divisionRawProduction = DIVISION_RAW_PRODUCTION[opts.industry]

  const upgradeMultiplier = caclulateUpgradeMultiplier(opts)

  const researchMultiplier = calculateResearchMultiplier(opts)

  const rawProduction = officeMultiplier * divisionRawProduction * upgradeMultiplier * researchMultiplier

  return rawProduction
}

function caclulateOfficeMultiplier(opts: Opts) {
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

function caclulateUpgradeMultiplier(opts: Opts) {
  const { smartFactoryLevel } = opts

  const upgradeMutliplier = 1 + 0.03 * smartFactoryLevel

  return upgradeMutliplier
}

function calculateResearchMultiplier(opts: Opts) {
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
