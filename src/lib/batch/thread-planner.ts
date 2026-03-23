import 'reflect-metadata'

import { Server } from '@ns'
import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../ns.identifier'

export interface Plan {
  hackThreads: number
  hackDelay: number
  growThreads: number
  growDelay: number
  weakenHackThreads: number
  weakenHackDelay: number
  weakenGrowThreads: number
  weakenGrowDelay: number
  totalThreads: number
}

const DELAY = 20

@injectable('Singleton')
export class ThreadPlanner {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    this.ns.print('INFO ThreadPlanner Initialized')
  }

  plan(target: Server): Plan {
    const player = this.ns.getPlayer()

    const maxMoney = target.moneyMax ?? 0

    const growTime = this.ns.formulas.hacking.growTime(target, player)
    const weakenTime = this.ns.formulas.hacking.weakenTime(target, player)
    const hackTime = this.ns.formulas.hacking.hackTime(target, player)

    const hackThreads = Math.max(Math.floor(0.2 / this.ns.formulas.hacking.hackPercent(target, player)), 0)
    const hackDelay = weakenTime - hackTime - DELAY * 2
    const hackSecurityIncrease = this.ns.hackAnalyzeSecurity(hackThreads, target.hostname)

    const growThreads = Math.max(
      this.ns.formulas.hacking.growThreads(this._getServerAfterHack(target, hackThreads), player, maxMoney),
      0,
    )
    const growDelay = weakenTime - growTime - DELAY
    // Don't provide target because the target is fully grown,
    // so the security increase would be 0.
    const growSecurityIncrease = this.ns.growthAnalyzeSecurity(growThreads, target.hostname)

    const weakenHackThreads = 0
    const weakenGrowThreads = this.calculateWeakenThreads(growSecurityIncrease + hackSecurityIncrease)

    return {
      hackThreads,
      hackDelay,
      growThreads,
      growDelay,
      weakenHackThreads,
      weakenHackDelay: 0,
      weakenGrowThreads,
      weakenGrowDelay: 0,
      totalThreads: hackThreads + growThreads + weakenHackThreads + weakenGrowThreads,
    }
  }

  planPrep(target: Server): Plan {
    const player = this.ns.getPlayer()

    const maxMoney = target.moneyMax ?? 0
    const minSecurity = target.minDifficulty ?? 0

    const growTime = this.ns.formulas.hacking.growTime(target, player)
    const weakenTime = this.ns.formulas.hacking.weakenTime(target, player)

    const growThreads = this.ns.formulas.hacking.growThreads(target, player, maxMoney)
    const growDelay = weakenTime - growTime + DELAY
    const growSecurityIncrease = this.ns.growthAnalyzeSecurity(growThreads, target.hostname)

    const currentSecurity = target.hackDifficulty ?? 0
    const securityToReduce = currentSecurity - minSecurity

    const weakenHackThreads = this.calculateWeakenThreads(securityToReduce)
    const weakenGrowThreads = this.calculateWeakenThreads(growSecurityIncrease)

    return {
      hackThreads: 0,
      hackDelay: 0,
      growThreads,
      growDelay,
      weakenHackThreads: weakenHackThreads,
      weakenHackDelay: 0,
      weakenGrowThreads: weakenGrowThreads,
      weakenGrowDelay: DELAY * 2,
      totalThreads: growThreads + weakenHackThreads + weakenGrowThreads,
    }
  }

  calculateWeakenThreads(securityIncrease: number): number {
    let i = 0

    while (this.ns.weakenAnalyze(i) < securityIncrease) {
      i++
    }

    // Adding an extra thread to make sure we reduce the security level enough, since weakenAnalyze only gives an estimate
    i++

    return i
  }

  _getServerAfterHack(_server: Server, hackThreads: number): Server {
    const player = this.ns.getPlayer()
    const server = { ..._server }

    const hackMoney = server.moneyMax
      ? server.moneyMax * (this.ns.formulas.hacking.hackPercent(server, player) * hackThreads)
      : undefined

    server.moneyAvailable = server.moneyAvailable && hackMoney ? server.moneyAvailable - hackMoney : undefined
    server.hackDifficulty = server.hackDifficulty
      ? server.hackDifficulty + this.ns.hackAnalyzeSecurity(hackThreads)
      : undefined

    return server
  }
}
