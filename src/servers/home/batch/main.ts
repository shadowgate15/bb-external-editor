import { nuke } from '@home/deploy/nuke'
import { assertIsString } from '@/lib/assert/is-string'
import { NS } from '@ns'
import { prep } from './prep'
import { runBatch } from './run-batch'
import { normalizeFlags } from './normalize-flags'

export async function main(ns: NS) {
  ns.disableLog('ALL')

  const target = assertIsString(ns.args[0], 'Please provide a target server as an argument')

  nuke(ns, target)

  ns.print(`INFO Starting preparation for ${target}...`)

  await prep(ns, target)

  ns.print(`SUCCESS Preparation completed for ${target}!`)
  ns.toast(`Preparation completed for ${target}!`, 'success')
  ns.print(`INFO Starting batch execution for ${target}...`)

  let batchCount = 0
  const { maxBatches } = normalizeFlags(ns)

  while (true) {
    if (maxBatches === -1 || batchCount < maxBatches) {
      batchCount++

      runBatch(ns, target)
        .then(() => {
          ns.print(`SUCCESS Batch execution completed for ${target}!`)
        })
        .catch((e) => {
          throw e
        })
        .finally(() => {
          batchCount--
        })

      ns.print(`INFO Batch ${batchCount} started for ${target}.`)
      await ns.asleep(50) // Sleep for a short time before starting the next batch
    } else {
      await ns.asleep(1000) // Sleep for a longer time if we've reached the max batch count
    }
  }
}
