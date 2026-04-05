import { CityName } from '@ns'

import { assertIsNumber } from '@/lib/assert/is-number'
import { assertIsString } from '@/lib/assert/is-string'

export async function main(ns: NS) {
  const divisionName = assertIsString(ns.args[0])
  const cityName = assertIsString(ns.args[1]) as CityName
  const size = assertIsNumber(ns.args[2])

  ns.corporation.upgradeOfficeSize(divisionName, cityName, size)
}
