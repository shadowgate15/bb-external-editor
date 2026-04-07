import 'reflect-metadata'

import { CorpIndustryData, CorpIndustryName } from '@ns'
import { inject, injectable } from 'inversify'
import { Observable, shareReplay } from 'rxjs'

import { CorporationDaemonServer } from './daemon/server'
import { ServerResponseKind } from './daemon/server.interface'

@injectable('Singleton')
export class IndustryData {
  readonly _data$: Observable<Record<CorpIndustryName, CorpIndustryData>> = this.server
    .exec$(ServerResponseKind.GetIndustryData, 'corporation/get-industry-data.js')
    .pipe(shareReplay(1))

  constructor(
    @inject(CorporationDaemonServer)
    private readonly server: CorporationDaemonServer,
  ) {
    this._data$.subscribe()
  }

  data$() {
    return this._data$
  }
}
