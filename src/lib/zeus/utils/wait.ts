/**
 * Polls `condition` every 1000 ms until it returns a truthy value.
 *
 * @param ns - The Netscript context used for sleeping between polls.
 * @param condition - A function that is called repeatedly; polling stops when it returns truthy.
 * @returns A promise that resolves once `condition` returns truthy.
 */
export async function waitFor(ns: NS, condition: () => boolean): Promise<void> {
  while (!condition()) {
    await ns.sleep(1000)
  }
}

/**
 * Polls corporation funds every 1000 ms until they meet or exceed `amount`.
 *
 * @param ns - The Netscript context used for sleeping between polls and reading funds.
 * @param amount - The minimum funds required before resolving.
 * @returns A promise that resolves once sufficient funds are available.
 */
export async function waitForFunds(ns: NS, amount: number): Promise<void> {
  return waitFor(ns, () => ns.corporation.getCorporation().funds >= amount)
}
