export interface NormalizedFlags {
  /**
   * Should the script run on the home server?
   *
   * @default false
   */
  home: boolean

  /**
   * Number of batches to run before stopping the script, set to -1 to run indefinitely
   */
  maxBatches: number
}

export function normalizeFlags(ns: NS): NormalizedFlags {
  const flags = ns.flags([
    ['home', false],
    ['maxBatches', -1],
  ])

  return flags as unknown as NormalizedFlags
}
