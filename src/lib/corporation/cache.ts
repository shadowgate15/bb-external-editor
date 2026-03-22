const CACHE_FILE = 'data/corporation.json'

type CacheItem = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
  expires?: number
}

export class Cache {
  private get data() {
    const fileContents = this.ns.read(CACHE_FILE)

    if (!fileContents) {
      this.ns.write(CACHE_FILE, JSON.stringify({}), 'w')

      return {}
    }

    return JSON.parse(fileContents) as Record<string, CacheItem>
  }

  constructor(private readonly ns: NS) {}

  get<Value>(key: string): Value | undefined {
    const item = this.data[key]

    if (!item) {
      return undefined
    }

    if (item.expires && item.expires < Date.now()) {
      this.delete(key)
    }

    return item.value as Value
  }

  async getOrSet<Value>(key: string, getter: () => Value | Promise<Value>, ttl?: number): Promise<Value> {
    const existing = this.get<Value>(key)

    if (existing !== undefined) return existing

    const getted = await getter()

    this.set(key, getted, ttl)

    return getted
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(key: string, value: any, ttl?: number) {
    const data: CacheItem = {
      value,
      expires: ttl ? Date.now() + ttl : undefined,
    }

    this.ns.write(CACHE_FILE, JSON.stringify({ ...this.data, [key]: data }), 'w')

    return true
  }

  delete(key: string) {
    const { [key]: _, ...rest } = this.data

    this.ns.write(CACHE_FILE, JSON.stringify(rest), 'w')

    return true
  }

  clear() {
    this.ns.write(CACHE_FILE, JSON.stringify({}), 'w')
  }
}

export function createCache(ns: NS) {
  return new Cache(ns)
}
