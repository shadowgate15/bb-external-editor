import 'reflect-metadata'

import { CorpMaterialConstantData, CorpMaterialName } from '@ns'
import { inject, injectable } from 'inversify'
import { Observable, shareReplay } from 'rxjs'

import { CorporationDaemonServer } from './daemon/server'
import { ServerResponseKind } from './daemon/server.interface'

@injectable('Singleton')
export class MaterialData {
  readonly _data$: Observable<Record<CorpMaterialName, CorpMaterialConstantData>> = this.server
    .exec$(ServerResponseKind.GetMaterialData, 'corporation/get-material-data.js')
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
