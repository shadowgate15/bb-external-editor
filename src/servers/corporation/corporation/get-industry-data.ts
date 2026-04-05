import { CorpIndustryData, CorpIndustryName } from '@ns'

import { createCorporationScript } from '@/lib/zeus/corporation-script'
import { ServerResponseKind } from '@/lib/zeus/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.GetIndustryData, async (ns) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret: Record<CorpIndustryName, CorpIndustryData> = {} as any

  for (const industry of ns.corporation.getConstants().industryNames) {
    ret[industry] = ns.corporation.getIndustryData(industry)
  }

  return ret
})
