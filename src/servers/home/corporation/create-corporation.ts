import { createCorporationScript } from '@/lib/corporation/corporation-script'
import { ServerResponseKind } from '@/lib/corporation/daemon/server.interface'

type Flags = {
  selfFund: boolean
}

export const main = createCorporationScript(ServerResponseKind.CreateCorporation, async (ns) => {
  const flags = ns.flags([['--selfFund', false]]) as Flags

  return ns.corporation.createCorporation('Shadow Industries', flags.selfFund)
})
