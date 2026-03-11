import 'reflect-metadata'

import EventEmitter from 'node:events'

export async function main(ns: NS) {
  ns.disableLog('ALL')
  ns.ui.openTail()

  const emitter = new EventEmitter()
}
