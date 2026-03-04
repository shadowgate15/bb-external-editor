import { NS } from '@ns'
import { getPortsThreshold } from './get-ports-threshold'

/**
 * This class is responsible for generating a list of servers that we can hack, based on the number of ports required to hack them.
 */
export class ServerList {
  private servers: Set<string> = new Set()

  static get(ns: NS): string[] {
    return new ServerList(ns).getServerList()
  }

  static getAll(ns: NS): string[] {
    return new ServerList(ns).getAllServers()
  }

  constructor(private readonly ns: NS) {
    // Add purchased servers to the list of servers to hack, since we know we can hack them
    for (const server of this.ns.getPurchasedServers()) {
      this.servers.add(server)
    }
  }

  getAllServers(): string[] {
    const visited = new Set<string>()

    const serversToVisit = this.ns.scan('home')
    let server: string | undefined = serversToVisit.pop()

    while (server) {
      if (visited.has(server)) {
        server = serversToVisit.pop()
        continue
      }

      this.servers.add(server)

      serversToVisit.push(...this.ns.scan(server))

      visited.add(server)

      server = serversToVisit.pop()
    }

    // Remote "home" from the list of servers, since we don't want to run hacks on our own server
    this.servers.delete('home')

    return Array.from(this.servers.values())
  }

  getServerList(): string[] {
    const visited = new Set<string>()

    const serversToVisit = this.ns.scan('home')
    let server: string | undefined = serversToVisit.pop()

    while (server) {
      if (visited.has(server)) {
        server = serversToVisit.pop()
        continue
      }

      if (this.shouldIncludeServer(server)) {
        this.servers.add(server)
      }

      serversToVisit.push(...this.ns.scan(server))

      visited.add(server)

      server = serversToVisit.pop()
    }

    // Remote "home" from the list of servers, since we don't want to run hacks on our own server
    this.servers.delete('home')

    return Array.from(this.servers.values())
  }

  shouldIncludeServer(host: string): boolean {
    return !this.servers.has(host) && this.ns.getServerNumPortsRequired(host) <= getPortsThreshold(this.ns)
  }
}
