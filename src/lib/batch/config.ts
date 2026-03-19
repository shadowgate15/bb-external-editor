import 'reflect-metadata'

import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../ns.identifier'

export interface BatchConfigJson {
  server?: string
}

@injectable()
export class BatchConfig {
  private get config(): BatchConfigJson {
    return JSON.parse(this.ns.read('config/batch.json'))
  }

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {}

  server() {
    return this.config.server
  }
}
