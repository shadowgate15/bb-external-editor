import 'reflect-metadata'

import { inject, injectable } from 'inversify'
import z from 'zod'

import { NSIdentifier } from '../ns.identifier'

const CONFIG_PATH = 'config.json'

const configSchema = z.object({
  enableBoostMaterials: z.boolean().default(false),
})
type ConfigData = z.infer<typeof configSchema>

@injectable('Singleton')
export class Config {
  private _data: ConfigData

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    this._readConfig()
  }

  private _readConfig() {
    const contents = this.ns.read(CONFIG_PATH)

    if (contents === '') {
      this._data = configSchema.parse({})
    } else {
      this._data = configSchema.parse(JSON.parse(contents))
    }
  }

  isBoostMaterialsEnabled() {
    return this._data.enableBoostMaterials
  }
}
