import { CityName, Product } from '@ns'

import { assertIsString } from '@/lib/assert/is-string'
import { createCorporationScript } from '@/lib/zeus/corporation-script'
import { ServerResponseKind } from '@/lib/zeus/daemon/server.interface'

export const main = createCorporationScript(ServerResponseKind.GetProducts, async (ns) => {
  const names = ns.args

  try {
    return names.reduce(
      (prev, name) => {
        const [divisionName, cityName, productName] = assertIsString(name).split('|') as [string, CityName, string]

        prev[divisionName] = {
          ...(prev[divisionName] || {}),
          [cityName]: {
            ...(prev[divisionName]?.[cityName] || {}),
            [productName]: ns.corporation.getProduct(divisionName, cityName, productName),
          },
        }

        return prev
      },
      {} as Record<string, Record<CityName, Record<string, Product>>>,
    )
  } catch {
    return null
  }
})
