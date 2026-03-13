/**
 * This is the parent server handlers, and are sent from the workers to the main server
 */
export type ParentChannelMethods = {
  /** Sent when the worker is complete */
  complete: () => Promise<void>

  /** Error sent from the worker */
  error: (error: unknown) => Promise<void>

  pong: (id: string) => Promise<void>
}

/**
 * This is the child server handlers, and are sent from the main server to the workers
 */
export type ChildChannelMethods = {
  startTime: (startTime: number) => Promise<void>
  ping: (id: string) => Promise<void>
}
