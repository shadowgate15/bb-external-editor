import { useNetscript } from './use-netscript'

export function useServerList(
  filter: (server: string) => boolean = () => true,
  pollInterval?: number,
): [serverList: string[], forceReolad: () => void] {
  const ns = useNetscript()

  const getServers = React.useCallback(() => {
    const servers = new Set<string>()

    const visited = new Set<string>()

    const serversToVisit = ['home'].concat(ns.scan('home'))
    let server: string | undefined = serversToVisit.pop()

    while (server) {
      if (visited.has(server)) {
        server = serversToVisit.pop()
        continue
      }

      if (filter(server)) {
        servers.add(server)
      }

      serversToVisit.push(...ns.scan(server))

      visited.add(server)

      server = serversToVisit.pop()
    }

    return Array.from(servers.values())
  }, [ns])

  const [serverList, setServerList] = React.useState(getServers())

  React.useEffect(() => {
    setServerList(getServers())

    if (!pollInterval) return

    const intervalID = setInterval(() => setServerList(getServers()), pollInterval)

    return () => clearInterval(intervalID)
  }, [getServers, pollInterval])

  return [
    serverList,
    () => {
      setServerList(getServers())
    },
  ]
}
