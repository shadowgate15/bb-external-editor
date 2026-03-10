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

    if (this.ns.fileExists('BruteSSH.exe', 'home')) {
      this.ns.brutessh(server)
    }

    if (this.ns.fileExists('FTPCrack.exe', 'home')) {
      this.ns.ftpcrack(server)
    }

    if (this.ns.fileExists('relaySMTP.exe', 'home')) {
      this.ns.relaysmtp(server)
    }

    if (this.ns.fileExists('HTTPWorm.exe', 'home')) {
      this.ns.httpworm(server)
    }

    if (this.ns.fileExists('SQLInject.exe', 'home')) {
      this.ns.sqlinject(server)
    }

    this.ns.nuke(server)
  }
}
