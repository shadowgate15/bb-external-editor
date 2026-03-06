export async function main(ns: NS) {
  const visited = new Set<string>()

  const search = (server: string, path: string[]) => {
    if (visited.has(server)) {
      return null
    }

    visited.add(server)

    if (server === 'run4theh111z') {
      return [[...path, server]]
    }

    const servers = ns.scan(server)
    let possiblePaths: string[][] = []

    for (const s of servers) {
      const res = search(s, [...path, server])

      if (res) possiblePaths = possiblePaths.concat(res)
    }

    return possiblePaths
  }

  ns.tprint(search('home', []))
}
