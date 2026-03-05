import { assertIsNumber } from '@/lib/assert/is-number'
import { NS } from '@ns'

export async function main(ns: NS) {
  const target = ns.args[0]

  if (!target || typeof target !== 'string') {
    throw new Error('Please provide a target server as an argument')
  }

  const startTime = assertIsNumber(ns.args[1], 'Start time must be a number')

  const portNumber = ns.args[2] as number

  if (portNumber !== undefined) {
    ns.atExit(() => {
      ns.tryWritePort(portNumber, 'hack')
    })
  }

  ns.print(new Date().toLocaleString() + ` - Starting hack on ${target} at ${new Date(startTime).toLocaleString()}`)
  await ns.hack(target, { additionalMsec: startTime - Date.now() })
}
