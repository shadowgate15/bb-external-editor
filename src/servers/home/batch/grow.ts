import { NS } from '@ns'

export async function main(ns: NS) {
  const target = ns.args[0]

  if (!target || typeof target !== 'string') {
    throw new Error('Please provide a target server as an argument')
  }

  const delay = (ns.args[1] as number) || 0

  const portNumber = ns.args[2] as number

  if (portNumber !== undefined) {
    ns.atExit(() => {
      ns.tryWritePort(portNumber, 'hack')
    })
  }

  ns.print(new Date().toLocaleString() + ` - Starting grow on ${target} with delay of ${delay}ms`)
  await ns.grow(target, { additionalMsec: delay })
}
