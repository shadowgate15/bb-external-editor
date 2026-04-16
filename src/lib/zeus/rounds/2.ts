import { assertIsString } from '@/lib/assert/is-string'

import { StorageUpgrader } from '../storage-upgrader'

export async function round2(ns: NS) {
  // Purchase Export unlock if not already unlocked
  if (!ns.corporation.hasUnlock('Export')) {
    ns.corporation.purchaseUnlock('Export')
  }

  const corp = ns.corporation.getCorporation()

  /**
   * Upgrade all Agriculture offices to size 9 to maximize export production
   */
  const agDivisionName = assertIsString(
    corp.divisions.find((d) => ns.corporation.getDivision(d).type === 'Agriculture'),
  )
  const agDivision = ns.corporation.getDivision(agDivisionName)

  for (const cityName of agDivision.cities) {
    const office = ns.corporation.getOffice(agDivisionName, cityName)

    if (office.size < 9) {
      ns.corporation.upgradeOfficeSize(agDivisionName, cityName, 9 - office.size)
    }

    // Hire Employes up to 9 (max for size 9 office) to maximize production
    while (office.numEmployees < 9) {
      ns.corporation.hireEmployee(agDivisionName, cityName)
    }

    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Operations', 2)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Engineer', 2)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Business', 2)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Management', 2)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Research & Development', 1)
  }

  while (agDivision.numAdVerts < 8) {
    ns.corporation.hireAdVert(agDivisionName)
  }

  /**
   * Create the Chemical division
   */
  const chemicalDivisionName = 'Chemical'

  ns.corporation.expandIndustry('Chemical', chemicalDivisionName)

  for (const cityName of Object.values(ns.enums.CityName)) {
    ns.corporation.expandCity(chemicalDivisionName, cityName)
    ns.corporation.purchaseWarehouse(chemicalDivisionName, cityName)

    const office = ns.corporation.getOffice(agDivisionName, cityName)

    if (office.size < 5) {
      ns.corporation.upgradeOfficeSize(agDivisionName, cityName, 5 - office.size)
    }

    // Hire Employes up to 5 (max for size 5 office) to maximize production
    while (office.numEmployees < 5) {
      ns.corporation.hireEmployee(agDivisionName, cityName)
    }

    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Operations', 1)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Engineer', 1)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Business', 1)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Management', 1)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Research & Development', 1)
  }

  /**
   * Optimize Agriculture `Smart Storage`, `Smart Factory`, and warehouse levels with remaining funds
   */

  const storageUpgrader = new StorageUpgrader(ns)

  storageUpgrader.upgradeStorage(agDivisionName, true)
}
