import { CorporationDaemonServer, createCorporationDaemonServer } from '@/lib/corporation/daemon/server'

export async function main(ns: NS) {
  ns.disableLog('ALL')
  ns.ui.openTail()
  await ns.asleep(0)

  const app = new App(ns)

  await app.setupCorporation()

  // Agriculture is the easiest division to set up, so we do it first to get the benefits of having a division (e.g. being able to buy materials) as soon as possible
  await app.setupAgriculture()
}

class App {
  readonly server: CorporationDaemonServer

  constructor(public ns: NS) {
    this.server = createCorporationDaemonServer(ns)
    this.server.listen()

    this.ns.atExit(() => {
      this.server.close()
    }, crypto.randomUUID())
  }

  async setupCorporation() {
    const canCreateCorporation = this.ns.corporation.canCreateCorporation(false)

    switch (canCreateCorporation) {
      case 'CorporationExists': {
        this.ns.print('SUCCESS Corporation already exists, skipping creation')

        return
      }
      case 'Success': {
        await this.createCorporation(false)

        break
      }
      case 'UseSeedMoneyOutsideBN3': {
        await this.createCorporation(true)

        break
      }
      case 'NoSf3OrDisabled':
      case 'DisabledBySoftCap': {
        this.ns.print('ERROR Cannot create corporation, either due to missing SF3 or soft cap reached')

        this.ns.exit()
      }
    }
  }

  async createCorporation(selfFund: boolean) {
    this.ns.print(`INFO Creating corporation ${selfFund ? 'self funded' : ''}...`)

    // Clear cache to ensure we have the most up to date information about the corporation
    this.server.clearCache()

    const result = await this.server.createCorporation(selfFund)

    if (!result) {
      throw new Error('Failed to create corporation')
    }

    this.ns.print('SUCCESS Corporation created')
  }

  async setupAgriculture() {
    this.ns.print('INFO Setting up agriculture division...')

    const existingDivision = await this.server.getDivision('Ag')

    if (existingDivision) {
      this.ns.print('SUCCESS Agriculture division already exists, skipping creation')

      return
    }

    // FIXME: use proper name for this
    await this.server.expandIndustry('Agriculture', 'Ag')

    this.ns.print('SUCCESS Agriculture division created')
  }
}
