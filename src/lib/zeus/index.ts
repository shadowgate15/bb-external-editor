import { ContainerModule } from 'inversify'

import { App } from './app'
import { Config } from './config'
import { Corporation } from './corporation'
import { CorporationDaemonServer } from './daemon/server'
import { Divisions } from './divisions'
import { IndustryData } from './industry-data'
import { MaterialData } from './material-data'
import { Offices } from './offices'
import { Seller } from './seller'
import { SmartSupply } from './smart-supply'
import { StateManager } from './state-manager'
import { TotalRawProduction } from './total-raw-production'
import { Warehouses } from './warehouses'

export const zeusModule = new ContainerModule((options) => {
  options.bind(App).toSelf()
  options.bind(CorporationDaemonServer).toSelf()
  options.bind(StateManager).toSelf()
  options.bind(Seller).toSelf()
  options.bind(SmartSupply).toSelf()
  options.bind(TotalRawProduction).toSelf()
  options.bind(Corporation).toSelf()
  options.bind(Divisions).toSelf()
  options.bind(Offices).toSelf()
  options.bind(MaterialData).toSelf()
  options.bind(IndustryData).toSelf()
  options.bind(Warehouses).toSelf()
  options.bind(Config).toSelf()
})
