import { buildProviderModule } from '@inversifyjs/binding-decorators'
import { Container, ContainerModule, type Factory, ServiceIdentifier } from 'inversify'

import { buildBatchBatchModule } from '../batch'
import { PriorityProvider } from './priority-provider'
import { BatchRunner } from './runner'
import { TargetProvider } from './target-provider'

export type BatchRunnerFactory = Factory<BatchRunner, [target: string, priority?: number]>
export const RunnerFactory: ServiceIdentifier<BatchRunnerFactory> = Symbol('RunnerFactory')

export function buildRunnerModule(parentContainer: Container) {
  return new ContainerModule(async (options) => {
    options.bind(RunnerFactory).toFactory((_context) => async (target, priority) => {
      const container = new Container({ parent: parentContainer })

      await container.load(buildProviderModule())
      await container.load(buildBatchBatchModule(container))

      container.bind(TargetProvider).toConstantValue(target)
      container.bind(PriorityProvider).toConstantValue(priority)

      return container.get(BatchRunner)
    })
  })
}
