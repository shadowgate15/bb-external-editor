import { BasePortNumberBuilder, PortNumberType } from '../base'
import { assertHeroEnum } from '../utils'

enum Hero {
  Server,
}

assertHeroEnum(Hero)

export class HermesTitanPortNumberBuilder extends BasePortNumberBuilder {
  server() {
    return new BasePortNumberBuilder(this.assignPort(PortNumberType.Hero, Hero.Server))
  }
}
