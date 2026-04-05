import { CityName, Office } from '@ns'

import { assertIsString } from '@/lib/assert/is-string'
import { createCorporationScript } from '@/lib/zeus/corporation-script'
import { ServerResponseKind } from '@/lib/zeus/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.GetOffices, async (ns) => {
  const names = ns.args

  try {
    return names.reduce(
      (prev, name) => {
        const [divisionName, cityName] = assertIsString(name).split('|') as [string, CityName]

        prev[divisionName] = {
          ...(prev[divisionName] || {}),
          [cityName]: ns.corporation.getOffice(divisionName, cityName),
        }

        return prev
      },
      {} as Record<string, Record<CityName, Office>>,
    )
  } catch {
    return null
  }
})
