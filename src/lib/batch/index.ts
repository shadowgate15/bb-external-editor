import { buildProviderModule } from '@inversifyjs/binding-decorators'
import { Container, ContainerModule } from 'inversify'

import { buildRunnerModule } from './runner'

export { BatchManager } from './manager'

export function buildBatchModule(container: Container) {
  return new ContainerModule(async (options) => {
    await buildProviderModule().load(options)

    await buildRunnerModule(container).load(options)
  })
}
