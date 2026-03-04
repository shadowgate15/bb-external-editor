import { NS } from '@ns'
import { NotEnoughRamError, ThreadCoordinator } from './thread-coordinator'

export async function prep(ns: NS, target: string) {
  const maxMoney = ns.getServerMaxMoney(target)
  const minSecurity = ns.getServerMinSecurityLevel(target)

  const runPrep = async () => {
    const threadCoordinator = new ThreadCoordinator(ns)

    const currentMoney = ns.getServerMoneyAvailable(target)

    const growMultiplier = currentMoney > 0 ? maxMoney / currentMoney : maxMoney
    let growThreads = Math.ceil(ns.growthAnalyze(target, growMultiplier))
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads)

    const currentSecurity = ns.getServerSecurityLevel(target)
    const securityToReduce = currentSecurity - minSecurity

    const weakenThreadsForGrow = (() => {
      let i = 1

      while (ns.weakenAnalyze(i) < growSecurityIncrease) {
        i++
      }

      return i
    })()
    const weakenThreadsForCatchup = (() => {
      let i = 1

      while (ns.weakenAnalyze(i) < securityToReduce) {
        i++
      }

      return i
    })()
    let weakenThreads = weakenThreadsForGrow + weakenThreadsForCatchup

    const growPortNumber = Date.now()
    const weakenPortNumber = Date.now() + 1

    try {
      threadCoordinator.addWeakenThreads(target, weakenThreads, 0, weakenPortNumber)
    } catch (e) {
      // If theree is not enough RAM to add weaken threads,
      // then we doen't want to wait on the weaken threads
      if (e instanceof NotEnoughRamError) weakenThreads = 0
      else throw e
    }
    try {
      threadCoordinator.addGrowThreads(target, growThreads, 0, growPortNumber)
    } catch (e) {
      // If theree is not enough RAM to add grow threads,
      // then we doen't want to wait on the grow threads
      if (e instanceof NotEnoughRamError) growThreads = 0
      else throw e
    }

    await Promise.all([
      (async () => {
        if (growThreads > 0) {
          await ns.nextPortWrite(growPortNumber)
        }
      })(),
      (async () => {
        if (weakenThreads > 0) {
          await ns.nextPortWrite(weakenPortNumber)
        }
      })(),
    ])
  }

  while (ns.getServerSecurityLevel(target) > minSecurity || ns.getServerMoneyAvailable(target) < maxMoney) {
    await runPrep()
  }
}
