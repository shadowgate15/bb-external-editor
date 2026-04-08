import { ContainerModule } from 'inversify'

import { App } from './app'
import { Corporation } from './corporation'
import { CorporationDaemonServer } from './daemon/server'
import { Divisions } from './divisions'
import { IndustryData } from './industry-data'
import { MaterialData } from './material-data'
import { Offices } from './offices'
import { Seller } from './seller'
import { SmartSupplyV2 } from './smart-supply-v2'
import { TotalRawProduction } from './smart-supply-v2/total-raw-production'
import { StateManager } from './state-manager'
import { Warehouses } from './warehouses'

export const zeusModule = new ContainerModule((options) => {
  options.bind(App).toSelf()
  options.bind(CorporationDaemonServer).toSelf()
  options.bind(StateManager).toSelf()
  options.bind(SmartSupplyV2).toSelf()
  options.bind(Seller).toSelf()
  options.bind(Corporation).toSelf()
  options.bind(Divisions).toSelf()
  options.bind(Offices).toSelf()
  options.bind(MaterialData).toSelf()
  options.bind(IndustryData).toSelf()
  options.bind(Warehouses).toSelf()
  options.bind(TotalRawProduction).toSelf()
})
