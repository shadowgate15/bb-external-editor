import 'reflect-metadata'

import { ToastVariant } from '@ns'
import { inject, injectable } from 'inversify'

import { assertIsString } from '@/lib/assert/is-string'
import { NSIdentifier } from '@/lib/ns.identifier'

import { Divisions } from '../divisions'
import { waitFor, waitForFunds } from '../utils/wait'

/** Target office size for Agriculture division cities in round 2. */
const AG_OFFICE_SIZE = 9

/** Target number of AdVerts for the Agriculture division in round 2. */
const AG_ADVERTS_TARGET = 8

/** Target office size for the Chemical division cities in round 2. */
const CHEMICAL_OFFICE_SIZE = 5

/** Name of the Chemical division created during round 2. */
const CHEMICAL_DIVISION_NAME = 'Chemical'

/**
 * Injectable service that executes all round-2 corporation setup steps:
 * upgrading Agriculture offices, hiring AdVerts, and bootstrapping the
 * Chemical division across all cities.
 */
@injectable('Singleton')
export class Round2 {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,

    @inject(Divisions)
    private readonly divisions: Divisions,
  ) {}

  /**
   * Executes the full round-2 setup sequence and resolves when complete.
   */
  async run(): Promise<void> {
    // Purchase Export unlock if not already unlocked
    if (!this.ns.corporation.hasUnlock('Export')) {
      this.ns.corporation.purchaseUnlock('Export')
    }

    /**
     * Upgrade all Agriculture offices to size AG_OFFICE_SIZE to maximize export production
     */
    const agDivisionName = assertIsString(
      this.divisions.findDivisionNameByType('Agriculture'),
      'No Agriculture division found',
    )
    const agDivision = () => this.ns.corporation.getDivision(agDivisionName)

    for (const cityName of agDivision().cities) {
      const office = () => this.ns.corporation.getOffice(agDivisionName, cityName)

      if (office().size < AG_OFFICE_SIZE) {
        await waitForFunds(
          this.ns,
          this.ns.corporation.getOfficeSizeUpgradeCost(agDivisionName, cityName, AG_OFFICE_SIZE - office().size),
        )

        this.ns.corporation.upgradeOfficeSize(agDivisionName, cityName, AG_OFFICE_SIZE - office().size)
        this.log(`Upgraded ${agDivisionName} office in ${cityName} to size ${AG_OFFICE_SIZE}`, 'success')
      }

      // Hire employees up to AG_OFFICE_SIZE (max for size-9 office) to maximize production
      while (office().numEmployees < AG_OFFICE_SIZE) {
        await waitFor(this.ns, () => this.ns.corporation.hireEmployee(agDivisionName, cityName))

        this.log(
          `Hired employee for ${agDivisionName} in ${cityName} (${office().numEmployees}/${AG_OFFICE_SIZE})`,
          'success',
        )
      }
    }

    while (agDivision().numAdVerts < AG_ADVERTS_TARGET) {
      await waitForFunds(this.ns, this.ns.corporation.getHireAdVertCost(agDivisionName))

      this.ns.corporation.hireAdVert(agDivisionName)

      this.log(`Hired AdVert for ${agDivisionName} (${agDivision().numAdVerts}/${AG_ADVERTS_TARGET})`, 'success')
    }

    /**
     * Create the Chemical division
     */
    if (!this.ns.corporation.getCorporation().divisions.includes(CHEMICAL_DIVISION_NAME)) {
      this.ns.corporation.expandIndustry('Chemical', CHEMICAL_DIVISION_NAME)
      this.log(`Expanded industry ${CHEMICAL_DIVISION_NAME}`, 'success')
    }

    for (const cityName of Object.values(this.ns.enums.CityName)) {
      const office = () => this.ns.corporation.getOffice(CHEMICAL_DIVISION_NAME, cityName)

      if (!this.ns.corporation.getDivision(CHEMICAL_DIVISION_NAME).cities.includes(cityName)) {
        this.ns.corporation.expandCity(CHEMICAL_DIVISION_NAME, cityName)
        this.log(`Expanded ${CHEMICAL_DIVISION_NAME} to ${cityName}`, 'success')
      }

      if (!this.ns.corporation.hasWarehouse(CHEMICAL_DIVISION_NAME, cityName)) {
        this.ns.corporation.purchaseWarehouse(CHEMICAL_DIVISION_NAME, cityName)
      }
      await waitForFunds(this.ns, this.ns.corporation.getUpgradeWarehouseCost(CHEMICAL_DIVISION_NAME, cityName))
      this.ns.corporation.upgradeWarehouse(CHEMICAL_DIVISION_NAME, cityName, 1)
      this.log(`Purchased warehouse for ${CHEMICAL_DIVISION_NAME} in ${cityName}`, 'success')

      if (office().size < CHEMICAL_OFFICE_SIZE) {
        await waitForFunds(
          this.ns,
          this.ns.corporation.getOfficeSizeUpgradeCost(
            CHEMICAL_DIVISION_NAME,
            cityName,
            CHEMICAL_OFFICE_SIZE - office().size,
          ),
        )
        this.ns.corporation.upgradeOfficeSize(CHEMICAL_DIVISION_NAME, cityName, CHEMICAL_OFFICE_SIZE - office().size)
        this.log(`Upgraded ${CHEMICAL_DIVISION_NAME} office in ${cityName} to size ${CHEMICAL_OFFICE_SIZE}`, 'success')
      }

      // Hire employees up to CHEMICAL_OFFICE_SIZE (max for size-5 office) to maximize production
      while (office().numEmployees < CHEMICAL_OFFICE_SIZE) {
        await waitFor(this.ns, () => this.ns.corporation.hireEmployee(CHEMICAL_DIVISION_NAME, cityName))

        this.log(
          `Hired employee for ${CHEMICAL_DIVISION_NAME} in ${cityName} (${office().numEmployees}/${CHEMICAL_OFFICE_SIZE})`,
          'success',
        )
      }
    }
  }

  private log(msg: string, variant: ToastVariant | `${ToastVariant}`) {
    this.ns.print(`SUCCESS ${msg}`)
    this.ns.toast(msg, variant)
  }
}
