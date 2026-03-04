export function assertIsString(value: unknown, msg?: string): string {
  if (typeof value !== 'string') {
    throw new Error(msg || `Expected a string but got ${typeof value}`)
  }

  return value
}
