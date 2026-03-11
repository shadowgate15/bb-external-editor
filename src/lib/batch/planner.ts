import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
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

@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class ThreadPlanner {
  constructor(
    @inject(NSIdentifier)
    private readonly ns: NS,
  ) {
    this.ns.print('INFO ThreadPlanner Initialized')
  }

  plan(target: string): Plan {
    const maxMoney = this.ns.getServerMaxMoney(target)
    const availableMoney = this.ns.getServerMoneyAvailable(target)

    const growTime = this.ns.getGrowTime(target)
    const weakenTime = this.ns.getWeakenTime(target)
    const hackTime = this.ns.getHackTime(target)

    const hackMoney = maxMoney * 0.2
    // This should be a positive number, but just in case hackAnalyzeThreads returns a negative number, we set it to 0
    const hackThreads = Math.max(Math.floor(this.ns.hackAnalyzeThreads(target, hackMoney)), 0)
    const hackDelay = weakenTime - hackTime - DELAY
    const hackSecurityIncrease = this.ns.hackAnalyzeSecurity(hackThreads, target)

    const postHackMoney = availableMoney - hackMoney
    const growMultiplier = postHackMoney > 0 ? maxMoney / postHackMoney : maxMoney
    const growThreads = Math.max(Math.ceil(this.ns.growthAnalyze(target, growMultiplier)), 0)
    const growDelay = weakenTime - growTime + DELAY
    // Don't provide target because the target is fully grown,
    // so the security increase would be 0.
    const growSecurityIncrease = this.ns.growthAnalyzeSecurity(growThreads)

    const weakenHackThreads = this.calculateWeakenThreads(hackSecurityIncrease)
    const weakenGrowThreads = this.calculateWeakenThreads(growSecurityIncrease)

    return {
      hackThreads,
      hackDelay,
      growThreads,
      growDelay,
      weakenHackThreads,
      weakenHackDelay: 0,
      weakenGrowThreads,
      weakenGrowDelay: DELAY * 2,
      totalThreads: hackThreads + growThreads + weakenHackThreads + weakenGrowThreads,
    }
  }

  planPrep(target: string): Plan {
    const maxMoney = this.ns.getServerMaxMoney(target)
    const availableMoney = this.ns.getServerMoneyAvailable(target)
    const minSecurity = this.ns.getServerMinSecurityLevel(target)

    const growTime = this.ns.getGrowTime(target)
    const weakenTime = this.ns.getWeakenTime(target)

    const growMultiplier = availableMoney > 0 ? maxMoney / availableMoney : maxMoney
    const growThreads = Math.max(Math.ceil(this.ns.growthAnalyze(target, growMultiplier)), 0)
    const growDelay = weakenTime - growTime + DELAY
    const growSecurityIncrease = this.ns.growthAnalyzeSecurity(growThreads)

    const currentSecurity = this.ns.getServerSecurityLevel(target)
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
}
