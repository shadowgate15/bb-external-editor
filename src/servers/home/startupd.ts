/**
 * This script is meant to be run on home at startup.
 * It will check if the last augmentation reset and the last node reset were less than 1 minute ago,
 * and if so, it will clear the batch data file.
 */
export async function main(ns: NS) {
  const { lastAugReset, lastNodeReset } = ns.getResetInfo()
  const now = Date.now()

  if (now - lastAugReset < 1000 * 60 && now - lastNodeReset < 1000 * 60) {
    ns.write('data/batch.json', JSON.stringify({}), 'w')
    ns.write('data/zeus.json', JSON.stringify({}), 'w')
  }
}
