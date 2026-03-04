export interface NormalizedFlags {
  /**
   * Should the script run on the home server?
   *
   * @default false
   */
  home: boolean
  /**
   * Max number of batches to run in parallel.
   *
   * @default 1
   */
  maxBatches: number
}

export function normalizeFlags(ns: NS): NormalizedFlags {
  const flags = ns.flags([
    ['home', false],
    ['maxBatches', 1],
  ])

  return flags as unknown as NormalizedFlags
}
