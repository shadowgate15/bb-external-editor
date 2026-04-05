import { CorpMaterialConstantData, CorpMaterialName } from '@ns'

import { createCorporationScript } from '@/lib/zeus/corporation-script'
import { ServerResponseKind } from '@/lib/zeus/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.GetMaterialData, async (ns) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret: Record<CorpMaterialName, CorpMaterialConstantData> = {} as any

  for (const material of ns.corporation.getConstants().materialNames) {
    ret[material] = ns.corporation.getMaterialData(material)
  }

  return ret
})
