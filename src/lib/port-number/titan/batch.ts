import { BasePortNumberBuilder, PortArray, PortNumberType } from '../base'
import { assertHeroEnum } from '../utils'

enum Hero {
  Parent,
  Hack,
  Weaken,
  Grow,
}

assertHeroEnum(Hero)

export class BatchTitanPortNumberBuilder extends BasePortNumberBuilder {
  parent() {
    const portArray = [...this.portArray]

    portArray[PortNumberType.Hero] = String(Hero.Parent)

    return new BasePortNumberBuilder(portArray as PortArray)
  }

  hack() {
    const portArray = [...this.portArray]

    portArray[PortNumberType.Hero] = String(Hero.Hack)

    return new BasePortNumberBuilder(portArray as PortArray)
  }

  weaken() {
    const portArray = [...this.portArray]

    portArray[PortNumberType.Hero] = String(Hero.Weaken)

    return new BasePortNumberBuilder(portArray as PortArray)
  }

  grow() {
    const portArray = [...this.portArray]

    portArray[PortNumberType.Hero] = String(Hero.Grow)

    return new BasePortNumberBuilder(portArray as PortArray)
  }
}
