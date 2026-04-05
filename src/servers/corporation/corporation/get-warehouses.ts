import { CityName, Warehouse } from '@ns'

import { assertIsString } from '@/lib/assert/is-string'
import { createCorporationScript } from '@/lib/zeus/corporation-script'
import { ServerResponseKind } from '@/lib/zeus/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.GetWarehouses, async (ns) => {
  const names = ns.args

  try {
    return names.reduce(
      (prev, name) => {
        const [divisionName, cityName] = assertIsString(name).split('|') as [string, CityName]

        prev[divisionName] = {
          ...(prev[divisionName] || {}),
          [cityName]: ns.corporation.getWarehouse(divisionName, cityName),
        }

        return prev
      },
      {} as Record<string, Record<CityName, Warehouse>>,
    )
  } catch {
    return null
  }
})
