import { BasePortNumberBuilder, PortNumberType } from '../base'
import { assertHeroEnum } from '../utils'

enum Hero {
  Daemon,
}

assertHeroEnum(Hero)

export class CorporationTitanPortNumberBuilder extends BasePortNumberBuilder {
  daemon() {
    return new BasePortNumberBuilder(this.assignPort(PortNumberType.Hero, Hero.Daemon))
  }
}
