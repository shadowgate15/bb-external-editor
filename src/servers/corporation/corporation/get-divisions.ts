import { assertIsString } from '@/lib/assert/is-string'
import { createCorporationScript } from '@/lib/zeus/corporation-script'
import { ServerResponseKind } from '@/lib/zeus/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.GetDivisions, async (ns) => {
  const names = ns.args

  try {
    return names.map((name) => ns.corporation.getDivision(assertIsString(name)))
  } catch {
    return null
  }
})
