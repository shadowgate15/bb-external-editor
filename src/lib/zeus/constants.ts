import type { CityName } from '@ns'
import { PascalCase } from 'type-fest'

export const CITY_NAMES_MAP: Record<PascalCase<`${CityName}`>, `${CityName}`> = {
  Chongqing: 'Chongqing',
  Ishima: 'Ishima',
  Volhaven: 'Volhaven',
  Aevum: 'Aevum',
  Sector12: 'Aevum',
  NewTokyo: 'Aevum',
}
export const CITY_NAMES: `${CityName}`[] = Object.values(CITY_NAMES_MAP)
