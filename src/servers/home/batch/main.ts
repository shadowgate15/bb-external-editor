import { nuke } from '@home/deploy/nuke'
import { assertIsString } from '@/lib/assert/is-string'
import { NS } from '@ns'
import { prep } from './prep'
import { runBatch } from './run-batch'

export async function main(ns: NS) {
  ns.disableLog('ALL')

  const target = assertIsString(ns.args[0], 'Please provide a target server as an argument')

  nuke(ns, target)

  ns.print(`INFO Starting preparation for ${target}...`)

  await prep(ns, target)

  ns.print(`SUCCESS Preparation completed for ${target}!`)
  ns.print(`INFO Starting batch execution for ${target}...`)

  while (true) {
    runBatch(ns, target)
      .then(() => {
        ns.print(`SUCCESS Batch execution completed for ${target}!`)
      })
      .catch((e) => {
        throw e
      })

    await ns.asleep(50) // Sleep for a short time before starting the next batch
  }
}
