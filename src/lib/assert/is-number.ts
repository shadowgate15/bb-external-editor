export function assertIsNumber(value: unknown, msg?: string): number {
  if (typeof value !== 'number') {
    throw new Error(msg || `Expected a number, but got ${typeof value}`)
  }

  return value
}
