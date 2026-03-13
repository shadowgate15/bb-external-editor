import 'reflect-metadata'

export async function main(ns: NS) {
  ns.ui.openTail()

  const port = Math.floor((Date.now() + Math.random()) * 1_000_000)

  ns.print(`Using port ${port}`)

  ns.writePort(port, 'hello world')

  ns.print(ns.readPort(port))
}

const maxPortNumber = 9_007_199_254_740_991

const maxPortNumber2 = 90_07_19_92_54_74_09_91
