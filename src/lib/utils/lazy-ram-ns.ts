import isFunction from 'lodash/isFunction'
import isPlainObject from 'lodash/isPlainObject'

export function lazyRamNs(ns: NS): NS {
  let cachedRam = 1.6
  const addedPaths = new Set<string>()

  ns.ramOverride(cachedRam)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const createProxy = <T extends object | Function>(target: T, path: string[] = []): T => {
    let proxyHandler: ProxyHandler<T> = {
      get(target, p) {
        const value = target[p]

        if (isPlainObject(value) || isFunction(value)) {
          return createProxy(value, [...path, p.toString()])
        }

        return value
      },
    }

    if (isFunction(target)) {
      proxyHandler = {
        ...proxyHandler,
        apply(target, thisArg, argArray) {
          const p = path.join('.')

          if (!addedPaths.has(p)) {
            cachedRam += ns.getFunctionRamCost(p)
            ns.ramOverride(cachedRam)
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
          return (target as Function).apply(thisArg, argArray)
        },
      }
    }

    return new Proxy<T>(target, proxyHandler)
  }

  return createProxy(ns)
}
