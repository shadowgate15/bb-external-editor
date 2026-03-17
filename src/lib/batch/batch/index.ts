import { Container, ContainerModule, Factory, ServiceIdentifier } from 'inversify'

import { PriorityProvider } from '../runner/priority-provider'
import { Batch } from './batch'
import { ThreadPlanner } from './planner'

export type IBatchFactory = Factory<Batch, [priority?: number]>
export const BatchFactory: ServiceIdentifier<IBatchFactory> = Symbol('Batch')

export function buildBatchBatchModule(parentContainer: Container) {
  return new ContainerModule(async (options) => {
    options.bind(BatchFactory).toFactory((_context) => async (priority) => {
      const container = new Container({ parent: parentContainer })

      container.bind(ThreadPlanner).toSelf()
      container.bind(Batch).toSelf()

      if (priority !== undefined) {
        container.bind(PriorityProvider).toConstantValue(priority)
      }

      return container.get(Batch)
    })
  })
}
