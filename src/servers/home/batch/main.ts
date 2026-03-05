import { nuke } from '@home/deploy/nuke'
import { assertIsString } from '@/lib/assert/is-string'
import { NS } from '@ns'
import { normalizeFlags } from './normalize-flags'
import { prep } from './prep'
import { runBatch } from './run-batch'

export async function main(ns: NS) {
  ns.disableLog('ALL')

  const target = assertIsString(ns.args[0], 'Please provide a target server as an argument')
  const { maxBatches } = normalizeFlags(ns)

  nuke(ns, target)

  ns.print(`INFO Starting preparation for ${target}...`)

  await prep(ns, target)

  ns.print(`SUCCESS Preparation completed for ${target}!`)
  ns.print(`INFO Starting batch execution for ${target}...`)

  let batchCount = 0

  while (true) {
    //   if (batchCount < maxBatches) {
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
    // } else {
    //   // Wait until the batch count drops below or equal to 10 before starting a new batch
    //   while (batchCount >= maxBatches) {
    //     // Wait for 500ms before checking again
    //     await ns.asleep(500)
    //   }
    // }

    await ns.asleep(50) // Sleep for a short time before starting the next batch
  }
}
