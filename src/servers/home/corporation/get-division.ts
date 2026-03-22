import { assertIsString } from '@/lib/assert/is-string'
import { createCorporationScript } from '@/lib/corporation/corporation-script'
import { ServerResponseKind } from '@/lib/corporation/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.GetDivision, async (ns) => {
  const name = assertIsString(ns.args[0])

  try {
    return ns.corporation.getDivision(name)
  } catch {
    return null
  }
})
