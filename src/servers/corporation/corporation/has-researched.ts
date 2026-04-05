import { CorpResearchName } from '@ns'

import { createCorporationScript } from '@/lib/zeus/corporation-script'
import { ServerResponseKind } from '@/lib/zeus/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.HasResearched, async (ns) => {
  const names = ns.args as string[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret: Record<string, Record<CorpResearchName, boolean>> = {} as any

  for (const name of names) {
    for (const research of ns.corporation.getConstants().researchNames) {
      if (ret[name] === undefined) {
        ret[name] = {} as Record<CorpResearchName, boolean>
      }

      ret[name][research] = ns.corporation.hasResearched(name, research)
    }
  }

  return ret
})
