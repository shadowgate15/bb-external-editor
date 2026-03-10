import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../ns.identifier'

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class Nuker {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {}

  nuke(server: string) {
    if (this.ns.hasRootAccess(server)) {
      return
    }

    let ports = 0

    if (this.ns.fileExists('BruteSSH.exe', 'home')) {
      ports++
      this.ns.brutessh(server)
    }

    if (this.ns.fileExists('FTPCrack.exe', 'home')) {
      ports++
      this.ns.ftpcrack(server)
    }

    if (this.ns.fileExists('relaySMTP.exe', 'home')) {
      ports++
      this.ns.relaysmtp(server)
    }

    if (this.ns.fileExists('HTTPWorm.exe', 'home')) {
      ports++
      this.ns.httpworm(server)
    }

    if (this.ns.fileExists('SQLInject.exe', 'home')) {
      ports++
      this.ns.sqlinject(server)
    }

    if (this.ns.getServerNumPortsRequired(server) <= ports) {
      this.ns.nuke(server)
    }
  }
}
