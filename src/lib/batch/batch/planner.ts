import 'reflect-metadata'

import { Server } from '@ns'
import { inject, injectable } from 'inversify'

import { NSIdentifier } from '../../ns.identifier'
import { TargetProvider } from '../runner/target-provider'

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

    /** The host to target for the batch */
    @inject(TargetProvider)
    private readonly target: string,
  ) {
    this.ns.print('INFO ThreadPlanner Initialized')
  }

  plan(): Plan {
    const maxMoney = this.ns.getServerMaxMoney(this.target)

    const growTime = this.ns.getGrowTime(this.target)
    const weakenTime = this.ns.getWeakenTime(this.target)
    const hackTime = this.ns.getHackTime(this.target)

    const hackMoney = maxMoney * 0.2
    // This should be a positive number, but just in case hackAnalyzeThreads returns a negative number, we set it to 0
    const hackThreads = Math.max(Math.floor(this.ns.hackAnalyzeThreads(this.target, hackMoney)), 0)
    const hackDelay = weakenTime - hackTime - DELAY * 2
    const hackSecurityIncrease = this.ns.hackAnalyzeSecurity(hackThreads, this.target)

    const growThreads = Math.max(
      this.ns.formulas.hacking.growThreads(this._getServerAfterHack(hackThreads), this.ns.getPlayer(), maxMoney),
      0,
    )
    const growDelay = weakenTime - growTime - DELAY
    // Don't provide target because the target is fully grown,
    // so the security increase would be 0.
    const growSecurityIncrease = this.ns.growthAnalyzeSecurity(growThreads)

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

  planPrep(): Plan {
    const maxMoney = this.ns.getServerMaxMoney(this.target)
    const availableMoney = this.ns.getServerMoneyAvailable(this.target)
    const minSecurity = this.ns.getServerMinSecurityLevel(this.target)

    const growTime = this.ns.getGrowTime(this.target)
    const weakenTime = this.ns.getWeakenTime(this.target)

    const growMultiplier = availableMoney > 0 ? maxMoney / availableMoney : maxMoney
    const growThreads = Math.max(Math.ceil(this.ns.growthAnalyze(this.target, growMultiplier)), 0)
    const growDelay = weakenTime - growTime + DELAY
    const growSecurityIncrease = this.ns.growthAnalyzeSecurity(growThreads)

    const currentSecurity = this.ns.getServerSecurityLevel(this.target)
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

  _getServerAfterHack(hackThreads: number): Server {
    const player = this.ns.getPlayer()
    const server = this.ns.getServer(this.target)

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
