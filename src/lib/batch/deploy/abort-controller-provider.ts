import { ServiceIdentifier } from 'inversify'

export const AbortControllerProvider: ServiceIdentifier<AbortController> = Symbol('AbortControllerProvider')
