import { createCorporationScript } from '@/lib/zeus/corporation-script'
import { ServerResponseKind } from '@/lib/zeus/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.GetCorporation, async (ns) => {
  return ns.corporation.getCorporation()
})
