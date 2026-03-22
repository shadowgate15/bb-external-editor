import { CorpIndustryName } from '@ns'

import { assertIsString } from '@/lib/assert/is-string'
import { createCorporationScript } from '@/lib/corporation/corporation-script'
import { ServerResponseKind } from '@/lib/corporation/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.ExpandIndustry, async (ns) => {
  const industry = assertIsString(ns.args[0])
  const divisionName = assertIsString(ns.args[1])

  const isValidIndustry = (i: unknown): i is CorpIndustryName =>
    ns.corporation.getConstants().industryNames.includes(i as CorpIndustryName)

  if (!isValidIndustry(industry)) {
    throw new Error(`Invalid industry: ${industry}`)
  }

  ns.corporation.expandIndustry(industry, divisionName)
})
