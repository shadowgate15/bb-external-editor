import 'reflect-metadata'

import { ScriptArg } from '@ns'
import { inject, injectable } from 'inversify'
import { JSONRPCRequest, JSONRPCServer, TypedJSONRPCServer } from 'json-rpc-2.0'
import { concatMap, first, map, Observable, OperatorFunction, Subject, Subscriber, tap } from 'rxjs'

import { NSIdentifier } from '@/lib/ns.identifier'
import { PortNumberBuilder } from '@/lib/port-number'

import { Config } from '../config'
import {
  Response,
  ServerMethodMap,
  ServerResponseKind,
  SuccessfulResponse,
  SuccessfulResponseWithKind,
} from './server.interface'

const kAbort = Symbol('abort')

function throwErrorResponse<T extends Response, R = SuccessfulResponse<T>>(): OperatorFunction<T, R> {
  return (source) =>
    source.pipe(
      map<T, R>((response) => {
        if (response.error) {
          throw response.error
        }

        return response as unknown as R
      }),
    )
}

type Request<Kind extends ServerResponseKind> = {
  kind: Kind
  script: string
  args: ScriptArg[]
  out: Subscriber<SuccessfulResponseWithKind<Kind>['data']>
}

@injectable('Singleton')
export class CorporationDaemonServer {
  protected readonly port: number

  protected readonly server: TypedJSONRPCServer<ServerMethodMap>

  protected readonly abortController = new AbortController()

  public readonly responses$$ = new Subject<Response>()

  private readonly request$$ = new Subject<Request<ServerResponseKind>>()

  constructor(
    @inject(NSIdentifier)
    protected readonly ns: NS,

    @inject(Config)
    protected readonly config: Config,
  ) {
    this.port = PortNumberBuilder.fromServer(this.ns, 'home').corporation().daemon().build()

    this.server = new JSONRPCServer()

    this.abortController.signal.addEventListener('abort', () => {
      this.ns.writePort(this.port, kAbort)
    })

    this.setupMethods()

    // Process incoming requests serially via concatMap so that each script
    // launch completes (or errors) before the next request is handled.
    // This prevents concurrent executions from racing on the shared response port.
    this.request$$
      .pipe(
        concatMap((request) => {
          const { kind, script, args, out: out$ } = request
          // Set up the response listener before launching the script so we don't
          // miss a fast response. Filters to the first message matching `kind`,
          // throws on error responses, then unwraps the typed data payload.
          const response$ = this.responses$$.pipe(
            first((response): response is Response => response.kind === kind),
            throwErrorResponse(),
            map((response) => response.data),
          )

          // Launch the script as a temporary process; it is expected to publish
          // its result back via the daemon's response port.
          const pid = this.ns.run(script, undefined, ...args)

          if (pid === 0) {
            this.ns.alert(`Failed to launch script ${script} for request kind ${kind}`)
            this.ns.exit()
          }

          // Forward the script's response (or error) to the caller's subject,
          // then complete it so the request lifecycle is fully closed out.
          return response$.pipe(
            tap({
              next: (value) => out$.next(value),
              error: (err) => out$.error(err),
              complete: () => out$.complete(),
            }),
          )
        }),
      )
      .subscribe()
  }

  private setupMethods() {
    this.server.addMethod('response', (response) => {
      this.responses$$.next(response)
    })

    this.server.addMethod('configUpdated', () => {
      this.config.read()
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
      this.responses$$.complete()
      this.request$$.complete()
      this.abortController.abort()
    }
  }

  /**
   * Executes a script on 'home' and returns an Observable that resolves to the
   * typed response data for the given `kind`. Runs inside the execMutex to
   * ensure only one script dispatch is in-flight at a time, preventing races
   * on the shared responses$$ subject.
   */
  exec$<Kind extends ServerResponseKind>(kind: Kind, script: string, ...args: ScriptArg[]) {
    return new Observable<SuccessfulResponseWithKind<Kind>['data']>((out) => {
      this.request$$.next({ kind, script, args, out })
    })
  }
}
