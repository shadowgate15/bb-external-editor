import 'reflect-metadata'

import { inject, injectable } from 'inversify'
import { Observable, ReplaySubject } from 'rxjs'
import z from 'zod'

import { NSIdentifier } from '../ns.identifier'

export const CONFIG_PATH = 'config.json'

export const configSchema = z.object({
  enableBoostMaterials: z.boolean().default(false),
})
export type ConfigData = z.infer<typeof configSchema>

@injectable('Singleton')
export class Config {
  private data$$ = new ReplaySubject<ConfigData>(1)

  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    this.read()
  }

  /** @returns Observable of the latest parsed config, re-emitted on each {@link read} call. */
  data$(): Observable<ConfigData> {
    return this.data$$
  }

  read() {
    const contents = this.ns.read(CONFIG_PATH)

    if (contents === '') {
      this.data$$.next(configSchema.parse({}))
    } else {
      this.data$$.next(configSchema.parse(JSON.parse(contents)))
    }
  }
}
