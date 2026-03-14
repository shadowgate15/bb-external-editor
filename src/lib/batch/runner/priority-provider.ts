import { ServiceIdentifier } from 'inversify'

export const PriorityProvider: ServiceIdentifier<number | undefined> = Symbol('PriorityProvider')
