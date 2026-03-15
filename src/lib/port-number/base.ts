import isNil from 'lodash/isNil'
import random from 'lodash/random'

const MAX_PORT_NUMBER = 9_00_71_99_25_47_40991

export type PortArray = [satyr?: string, nymph?: string, muse?: string, hero?: string, titan?: string, ip?: string]

export enum PortNumberType {
  Satyr,
  Nymph,
  Muse,
  Hero,
  Titan,
  IP,
}

export class BasePortNumberBuilder {
  constructor(protected readonly portArray: PortArray) {}

  fillRandom() {
    const [satyr, nymph, muse, hero, titan] = this.portArray

    if (isNil(satyr)) {
      let maxValue = 9

      if (!isNil(nymph) && nymph.padStart(2, '00') !== '00') {
        // When nymph is defined and not '00',
        // the maximum value for satyr is 8,
        // since 9 would create a port number that exceeds the maximum allowed value
        maxValue = 8
      }

      this.portArray[PortNumberType.Satyr] = String(random(0, maxValue))
    }

    if (isNil(nymph)) {
      if (this.portArray[PortNumberType.Satyr] === '9') {
        this.portArray[PortNumberType.Nymph] = '00'
      } else {
        this.portArray[PortNumberType.Nymph] = String(random(0, 71)).padStart(2, '0')
      }
    }

    if (isNil(muse)) {
      this.portArray[PortNumberType.Muse] = String(random(0, 99)).padStart(2, '0')
    }

    if (isNil(hero)) {
      this.portArray[PortNumberType.Hero] = String(random(0, 25)).padStart(2, '0')
    }

    if (isNil(titan)) {
      this.portArray[PortNumberType.Titan] = String(random(0, 47)).padStart(2, '0')
    }

    return this.build()
  }

  build() {
    const num = Number(
      this.portArray
        .map((s, index) => {
          const ret = s ?? '0'

          if (index === PortNumberType.Satyr) {
            return ret
          }

          if (index === PortNumberType.IP) {
            return ret.padStart(5, '0')
          }

          return ret.padStart(2, '0')
        })
        .join(''),
    )

    if (num > MAX_PORT_NUMBER) {
      throw new Error(`Port number ${num} exceeds maximum allowed value of ${MAX_PORT_NUMBER}`)
    }

    return num
  }
}
