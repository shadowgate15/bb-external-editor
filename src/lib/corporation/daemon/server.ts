import { CorpIndustryName, ScriptArg } from '@ns'
import { JSONRPCRequest, JSONRPCServer, TypedJSONRPCServer } from 'json-rpc-2.0'
import { filter, firstValueFrom, Subject } from 'rxjs'

import { PortNumberBuilder } from '@/lib/port-number'

import { Cache } from '../cache'
import {
  Response,
  ResponseWithKind,
  ServerMethodMap,
  ServerResponseKind,
  SuccessfulResponseWithKind,
} from './server.interface'

const SCRIPT_FILES: Record<ServerResponseKind, string> = {
  createCorporation: 'corporation/create-corporation.js',
  getDivision: 'corporation/get-division.js',
  expandIndustry: 'corporation/expand-industry.js',
}

const kAbort = Symbol('abort')

export class CorporationDaemonServer {
  protected readonly port: number

  protected readonly server: TypedJSONRPCServer<ServerMethodMap>

  protected readonly abortController = new AbortController()

  protected readonly cache: Cache

  protected readonly subject = new Subject<Response>()

  constructor(protected readonly ns: NS) {
    this.port = PortNumberBuilder.fromServer(this.ns, 'home').corporation().daemon().build()

    this.server = new JSONRPCServer()
    this.cache = new Cache(this.ns)

    this.abortController.signal.addEventListener('abort', () => {
      this.ns.writePort(this.port, kAbort)
    })

    this.setupMethods()
  }

  private setupMethods() {
    this.server.addMethod('response', (response) => {
      this.subject.next(response)
    })
  }

  async listen() {
    while (true) {
      while (!(this.ns.peek(this.port) === 'NULL PORT DATA')) {
        const message = this.ns.readPort(this.port)

        if (message === kAbort) {
          return
        }

        await this.server.receive(message as JSONRPCRequest)
      }

      await this.ns.nextPortWrite(this.port)
    }
  }

  close() {
    if (!this.abortController.signal.aborted) {
      this.subject.complete()
      this.abortController.abort()
    }
  }

  clearCache() {
    this.cache.clear()
  }

  private async _runScript<Kind extends ServerResponseKind>(
    kind: Kind,
    ...args: ScriptArg[]
  ): Promise<SuccessfulResponseWithKind<Kind>> {
    const ret = firstValueFrom(
      this.subject.pipe(filter<ResponseWithKind<Kind>>((response) => response.kind === kind)),
    ).then((response) => {
      if (response.error) {
        throw response.error
      }

      return response as unknown as SuccessfulResponseWithKind<Kind>
    })

    this.ns.exec(SCRIPT_FILES[kind], 'home', { temporary: true }, ...args)

    return ret
  }

  /**
   * Creates a corporation. If selfFund is true, the corporation will be funded with the player's money. Otherwise, it will be funded with a loan.
   *
   * @param selfFund Whether to fund the corporation with the player's money or a loan
   *
   * @returns true if the corporation was created successfully, false otherwise
   */
  async createCorporation(selfFund: boolean) {
    const kind = ServerResponseKind.CreateCorporation

    const ret = await this._runScript(kind, selfFund ? '--selfFund' : '')

    return ret.data
  }

  /**
   * Gets the division with the given name.
   *
   * @param name The name of the division to get
   *
   * @returns The division with the given name, or null if it doesn't exist
   */
  async getDivision(name: string) {
    const kind = ServerResponseKind.GetDivision

    return this.cache.getOrSet(`division.${name}`, async () => {
      const ret = await this._runScript(kind, name)

      return ret.data
    })
  }

  /**
   * Expands the corporation into the given industry.
   *
   * @param industry The industry to expand into
   * @param divisionName The name of the division to expand into the industry, if not provided, it will be the same as the industry name
   */
  async expandIndustry(industry: CorpIndustryName, divisionName?: string) {
    const kind = ServerResponseKind.ExpandIndustry

    await this._runScript(kind, industry, divisionName ?? industry)
  }
}

export function createCorporationDaemonServer(ns: NS) {
  return new CorporationDaemonServer(ns)
}
