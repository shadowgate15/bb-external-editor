type EnumLike = {
  [k: string]: string | number
  [nu: number]: string
}

export function assertTitanEnum(value: EnumLike) {
  if (Object.keys(value).length > 47)
    throw new Error(
      'Titan enum cannot have more than 47 values, since the titan portion of the port number can only be 2 digits long and must be less than or equal to 47',
    )
}

export function assertHeroEnum(value: EnumLike) {
  if (Object.keys(value).length > 25)
    throw new Error(
      'Hero enum cannot have more than 25 values, since the hero portion of the port number can only be 2 digits long and must be less than or equal to 25',
    )
}

export function assertMuseEnum(value: EnumLike) {
  if (Object.keys(value).length > 99)
    throw new Error(
      'Muse enum cannot have more than 99 values, since the muse portion of the port number can only be 2 digits long and must be less than or equal to 99',
    )
}

export function assertNymphEnum(value: EnumLike) {
  if (Object.keys(value).length > 71)
    throw new Error(
      'Nymph enum cannot have more than 71 values, since the nymph portion of the port number can only be 2 digits long and must be less than or equal to 71',
    )
}

export function assertSatyrEnum(value: EnumLike) {
  if (Object.keys(value).length > 9)
    throw new Error(
      'Satyr enum cannot have more than 9 values, since the satyr portion of the port number can only be 1 digit long and must be less than or equal to 9',
    )
}
