import { NS } from '@ns'
import { NotEnoughRamError, ThreadCoordinator } from './thread-coordinator'
import { randomNumber } from '@/lib/utils/random-number'

const DELAY = 20

export async function prep(ns: NS, target: string) {
  const maxMoney = ns.getServerMaxMoney(target)
  const minSecurity = ns.getServerMinSecurityLevel(target)

  const runPrep = async () => {
    const threadCoordinator = new ThreadCoordinator(ns)

    const currentMoney = ns.getServerMoneyAvailable(target)

    const growTime = ns.getGrowTime(target)
    const weakenTime = ns.getWeakenTime(target)

    const growMultiplier = currentMoney > 0 ? maxMoney / currentMoney : maxMoney
    let growThreads = Math.ceil(ns.growthAnalyze(target, growMultiplier))
    const growDalay = weakenTime - growTime + DELAY
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads)

    const currentSecurity = ns.getServerSecurityLevel(target)
    const securityToReduce = currentSecurity - minSecurity

    let weakenThreadsForGrow = (() => {
      let i = 1

      while (ns.weakenAnalyze(i) < growSecurityIncrease) {
        i++
      }

      return i
    })()
    let weakenThreadsForCatchup = (() => {
      let i = 1

      while (ns.weakenAnalyze(i) < securityToReduce) {
        i++
      }

      return i
    })()

    const growPortNumber = randomNumber()
    const weakenPortNumber = randomNumber()
    const startTime = Date.now() + 250

    try {
      threadCoordinator.addWeakenThreads(target, weakenThreadsForCatchup, startTime, weakenPortNumber)
    } catch (e) {
      // If theree is not enough RAM to add weaken threads,
      // then we doen't want to wait on the weaken threads
      if (e instanceof NotEnoughRamError) weakenThreadsForCatchup = e.threadsAdded
      else throw e
    }
    try {
      threadCoordinator.addGrowThreads(target, growThreads, startTime + growDalay, growPortNumber)
    } catch (e) {
      // If theree is not enough RAM to add grow threads,
      // then we doen't want to wait on the grow threads
      if (e instanceof NotEnoughRamError) growThreads = e.threadsAdded
      else throw e
    }
    try {
      threadCoordinator.addWeakenThreads(target, weakenThreadsForGrow, startTime + DELAY * 2, weakenPortNumber)
    } catch (e) {
      // If theree is not enough RAM to add weaken threads,
      // then we doen't want to wait on the weaken threads
      if (e instanceof NotEnoughRamError) weakenThreadsForGrow = e.threadsAdded
      else throw e
    }

    await Promise.all([
      (async () => {
        if (growThreads > 0) {
          await ns.nextPortWrite(growPortNumber)
        }
      })(),
      (async () => {
        if (weakenThreadsForCatchup + weakenThreadsForGrow > 0) {
          await ns.nextPortWrite(weakenPortNumber)
        }
      })(),
    ])

    // force a short sleep to allow all scripts to complete
    await ns.asleep(DELAY * 3)
  }

  let lastStartTime = 0

  while (ns.getServerSecurityLevel(target) > minSecurity || ns.getServerMoneyAvailable(target) < maxMoney) {
    const now = Date.now()

    if (lastStartTime + 1000 > now) {
      // This is an escape hatch to prevent the game from freezing
      throw new Error('There is not enough RAM to run prep. Please free up some RAM and try again.')
    }

    lastStartTime = now

    await runPrep()
  }
}
