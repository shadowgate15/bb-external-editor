import 'reflect-metadata'

import { inject, injectable } from 'inversify'
import { Observable, ReplaySubject } from 'rxjs'

import { NSIdentifier } from '../ns.identifier'
import { CONFIG_PATH, ConfigData, configSchema } from './config.interface'

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

  write(data: ConfigData) {
    this.ns.write(CONFIG_PATH, JSON.stringify(configSchema.parse(data)))
  }
}
