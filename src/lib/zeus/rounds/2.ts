import { ToastVariant } from '@ns'

import { assertIsString } from '@/lib/assert/is-string'

export async function round2(ns: NS) {
  ns.disableLog('sleep')
  ns.ui.openTail()
  await ns.sleep(100)

  const log = (msg: string, variant: ToastVariant | `${ToastVariant}`) => {
    ns.print(`SUCCESS ${msg}`)
    ns.toast(msg, variant)
  }

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
  let agDivision = ns.corporation.getDivision(agDivisionName)

  for (const cityName of agDivision.cities) {
    let office = ns.corporation.getOffice(agDivisionName, cityName)

    if (office.size < 9) {
      await waitForFunds(ns, ns.corporation.getOfficeSizeUpgradeCost(agDivisionName, cityName, 9 - office.size))

      ns.corporation.upgradeOfficeSize(agDivisionName, cityName, 9 - office.size)
      log(`Upgraded ${agDivisionName} office in ${cityName} to size 9`, 'success')
    }

    // Hire Employes up to 9 (max for size 9 office) to maximize production
    while (office.numEmployees < 9) {
      await waitFor(ns, () => ns.corporation.hireEmployee(agDivisionName, cityName))

      office = ns.corporation.getOffice(agDivisionName, cityName) // Refresh office info after hiring

      log(`Hired employee for ${agDivisionName} in ${cityName} (${office.numEmployees}/9)`, 'success')
    }

    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Operations', 2)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Engineer', 2)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Business', 2)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Management', 2)
    ns.corporation.setAutoJobAssignment(agDivisionName, cityName, 'Research & Development', 1)

    log(`Set job assignments for ${agDivisionName} in ${cityName}`, 'success')
  }

  while (agDivision.numAdVerts < 8) {
    await waitForFunds(ns, ns.corporation.getHireAdVertCost(agDivisionName))

    ns.corporation.hireAdVert(agDivisionName)

    agDivision = ns.corporation.getDivision(agDivisionName) // Refresh division info after hiring

    log(`Hired AdVert for ${agDivisionName} (${agDivision.numAdVerts}/8)`, 'success')
  }

  /**
   * Create the Chemical division
   */
  const chemicalDivisionName = 'Chemical'

  if (!ns.corporation.getCorporation().divisions.includes(chemicalDivisionName)) {
    ns.corporation.expandIndustry('Chemical', chemicalDivisionName)
    log(`Expanded industry ${chemicalDivisionName}`, 'success')
  }

  for (const cityName of Object.values(ns.enums.CityName)) {
    const office = () => ns.corporation.getOffice(chemicalDivisionName, cityName)

    if (!ns.corporation.getDivision(chemicalDivisionName).cities.includes(cityName)) {
      ns.corporation.expandCity(chemicalDivisionName, cityName)
      log(`Expanded ${chemicalDivisionName} to ${cityName}`, 'success')
    }

    if (!ns.corporation.hasWarehouse(chemicalDivisionName, cityName)) {
      ns.corporation.purchaseWarehouse(chemicalDivisionName, cityName)
    }
    await waitForFunds(ns, ns.corporation.getUpgradeWarehouseCost(chemicalDivisionName, cityName))
    ns.corporation.upgradeWarehouse(chemicalDivisionName, cityName, 1)
    log(`Purchased warehouse for ${chemicalDivisionName} in ${cityName}`, 'success')

    if (office().size < 5) {
      await waitForFunds(ns, ns.corporation.getOfficeSizeUpgradeCost(chemicalDivisionName, cityName, 5 - office().size))
      ns.corporation.upgradeOfficeSize(chemicalDivisionName, cityName, 5 - office().size)
      log(`Upgraded ${chemicalDivisionName} office in ${cityName} to size 5`, 'success')
    }

    // Hire Employes up to 5 (max for size 5 office) to maximize production
    while (office().numEmployees < 5) {
      await waitFor(ns, () => ns.corporation.hireEmployee(chemicalDivisionName, cityName))

      log(`Hired employee for ${chemicalDivisionName} in ${cityName} (${office().numEmployees}/5)`, 'success')
    }

    ns.corporation.setAutoJobAssignment(chemicalDivisionName, cityName, 'Operations', 1)
    ns.corporation.setAutoJobAssignment(chemicalDivisionName, cityName, 'Engineer', 1)
    ns.corporation.setAutoJobAssignment(chemicalDivisionName, cityName, 'Business', 1)
    ns.corporation.setAutoJobAssignment(chemicalDivisionName, cityName, 'Management', 1)
    ns.corporation.setAutoJobAssignment(chemicalDivisionName, cityName, 'Research & Development', 1)
    log(`Set job assignments for ${chemicalDivisionName} in ${cityName}`, 'success')
  }
}

async function waitFor(ns: NS, condition: () => boolean) {
  while (!condition()) {
    await ns.sleep(1000)
  }
}

async function waitForFunds(ns: NS, amount: number) {
  return waitFor(ns, () => ns.corporation.getCorporation().funds >= amount)
}
