import { NS } from '@ns'

import { assertIsString } from '@/lib/assert/is-string'
import { createCorporationDaemonClient } from '@/lib/zeus/daemon/client'

export async function main(ns: NS) {
  const divisionName = assertIsString(ns.args[0], 'Division name is required as the first argument')
  const { 'smart-factories': smartFactories } = ns.flags([['smart-factories', false]]) as {
    'smart-factories': boolean
  }

  const client = createCorporationDaemonClient(ns)
  client.send('upgradeStorage', { divisionName, smartFactories })

  ns.toast(`Storage upgrade requested for division "${divisionName}".`, 'info')
}
