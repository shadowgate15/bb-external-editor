import { NS } from '@ns'

export async function main(ns: NS) {
  const target = ns.args[0]

  if (!target || typeof target !== 'string') {
    throw new Error('Please provide a target server as an argument')
  }

  await ns.weaken(target)
}
