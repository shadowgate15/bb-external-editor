import { createCorporationDaemonClient } from './daemon/client'
import { ErrorResponseWithKind, ServerResponseKind, SuccessfulResponseWithKind } from './daemon/server.interface'

export function createCorporationScript<Kind extends ServerResponseKind>(
  kind: Kind,
  fn: (ns: NS) => Promise<SuccessfulResponseWithKind<Kind>['data']>,
) {
  return async (ns: NS) => {
    const client = createCorporationDaemonClient(ns)

    try {
      const data = await fn(ns)

      client.send('response', {
        kind,
        data,
      } as SuccessfulResponseWithKind<Kind>)
    } catch (error) {
      if (error instanceof Error) {
        client.send('response', {
          kind,
          error,
        } as ErrorResponseWithKind<Kind>)
      } else {
        client.send('response', {
          kind,
          error: new Error(String(error)),
        } as ErrorResponseWithKind<Kind>)
      }
    }
  }
}
