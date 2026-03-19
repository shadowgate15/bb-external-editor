export async function main(ns: NS) {
  const server = ns.args[0] ?? ''

  const json = JSON.parse(ns.read('config/batch.json'))

  json.server = server

  ns.write('config/batch.json', JSON.stringify(json, null, 2), 'w')

  ns.toast(`Set batch server to "${server}"`)
}
