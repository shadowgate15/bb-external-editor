import { assertIsString } from '@/lib/assert/is-string'

export async function main(ns: NS) {
  const serverToRename = assertIsString(ns.args[0])
  const serverNewName = assertIsString(ns.args[1])

  ns.renamePurchasedServer(serverToRename, serverNewName)
}
