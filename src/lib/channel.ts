import { JSONRPCClient, JSONRPCRequest, JSONRPCServer, TypedJSONRPCClient, TypedJSONRPCServer } from 'json-rpc-2.0'

const kAbort = Symbol('abort')

export type MethodsType = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (params?: any) => any
}

export class NSChannel<TServer extends MethodsType, TClient extends MethodsType> {
  protected readonly server: TypedJSONRPCServer<TServer>
  protected readonly client: TypedJSONRPCClient<TClient>

  protected readonly abortController = new AbortController()

  constructor(
    protected readonly ns: NS,
    protected readonly from: number,
    protected readonly to: number,
  ) {
    this.ns.atExit(() => {
      this.close()
    }, crypto.randomUUID())

    this.server = new JSONRPCServer()
    this.client = new JSONRPCClient((request) => {
      this.ns.writePort(this.to, request)
    })

    this.abortController.signal.addEventListener('abort', () => {
      this.ns.writePort(this.from, kAbort)
    })

    this.setupMethods()
  }

  send<K extends Extract<keyof TClient, string>>(method: K, params?: Parameters<TClient[K]>[0]) {
    this.client.notify(method, params)
  }

  async listen() {
    await this.preListen()

    while (true) {
      while (!(this.ns.peek(this.from) === 'NULL PORT DATA')) {
        const message = this.ns.readPort(this.from)

        if (message === kAbort) {
          return
        }

        await this.server.receive(message as JSONRPCRequest)
      }

      await this.ns.nextPortWrite(this.from)
    }
  }

  async preListen() {
    /** This is intentionally empty, but can be overridden by child classes to do some work before listen starts */
  }

  setupMethods() {
    /** This is intentionally empty, but can be overridden by child classes to setup methods */
  }

  close() {
    if (!this.abortController.signal.aborted) {
      this.abortController.abort()
    }
  }
}
