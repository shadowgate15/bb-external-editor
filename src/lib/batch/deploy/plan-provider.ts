import { ServiceIdentifier } from 'inversify'

import { Plan } from '../batch/planner'

export const PlanProvider: ServiceIdentifier<Plan> = Symbol('PlanProvider')
