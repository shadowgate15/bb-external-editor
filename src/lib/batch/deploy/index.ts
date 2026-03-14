import { buildProviderModule } from '@inversifyjs/binding-decorators'
import { Container, ContainerModule, Factory, ServiceIdentifier } from 'inversify'

import { ScriptAbortController } from '@/lib/utils/script-abort-controller'

import { Plan } from '../batch/planner'
import { Deployer } from './deployer'
import { PlanProvider } from './plan-provider'

export type BatchDeployerFactory = Factory<Deployer, [plan: Plan]>
export const DeployerFactory: ServiceIdentifier<BatchDeployerFactory> = Symbol('DeployerFactory')

export function buildDeployerModule(parentContainer: Container) {
  return new ContainerModule(async (options) => {
    options.bind(DeployerFactory).toFactory((_context) => async (plan) => {
      const container = new Container({ parent: parentContainer })

      await container.load(buildProviderModule())
      container.bind(PlanProvider).toConstantValue(plan)

      const abortController = new AbortController()
      container.get(ScriptAbortController).signal.addEventListener('abort', () => {
        abortController.abort()
      })
      container.bind(AbortController).toConstantValue(abortController)

      return container.get(Deployer)
    })
  })
}
