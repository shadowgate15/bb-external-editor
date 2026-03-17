import { buildProviderModule } from '@inversifyjs/binding-decorators'
import { Container, ContainerModule } from 'inversify'

import { PortProvider } from '../port-number'
import { buildRunnerModule } from './runner'

export { BatchManager } from './manager'

export function buildBatchModule(container: Container) {
  return new ContainerModule(async (options) => {
    await buildProviderModule().load(options)

    options.bind(PortProvider).toSelf()

    await buildRunnerModule(container).load(options)
  })
}
