import { buildProviderModule } from '@inversifyjs/binding-decorators'
import { Container, ContainerModule } from 'inversify'

import { PortProvider } from '../port-number'
import { BatchConfig } from './config'
import { buildRunnerModule } from './runner'
import { ThreadPlanner } from './thread-planner'

export { BatchManager } from './manager'

export function buildBatchModule(container: Container) {
  return new ContainerModule(async (options) => {
    await buildProviderModule().load(options)

    options.bind(ThreadPlanner).toSelf()

    options.bind(BatchConfig).toSelf()

    options.bind(PortProvider).toSelf()

    await buildRunnerModule(container).load(options)
  })
}
