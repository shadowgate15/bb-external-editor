import { CorpUpgradeName } from '@ns'

import { createCorporationScript } from '@/lib/zeus/corporation-script'
import { ServerResponseKind } from '@/lib/zeus/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.GetUpgradeLevels, async (ns) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret: Record<CorpUpgradeName, number> = {} as any

  for (const upgrade of ns.corporation.getConstants().upgradeNames) {
    ret[upgrade] = ns.corporation.getUpgradeLevel(upgrade)
  }

  return ret
})
