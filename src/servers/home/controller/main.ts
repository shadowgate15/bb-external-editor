import { nuke } from '@home/deploy/nuke'
import { ServerList } from '@home/deploy/server-list'
import { NS } from '@ns'

export async function main(ns: NS) {
  ns.disableLog('ALL')

  await new App(ns).run()
}

class App {
  private servers: string[]

  private readonly weakenScriptSize: number
  private readonly growScriptSize: number
  private readonly hackScriptSize: number

  private get maxMoney() {
    return this.ns.getServerMaxMoney(this.target)
  }

  private get availableMoney() {
    return this.ns.getServerMoneyAvailable(this.target)
  }

  private get moneyThreshold() {
    return this.maxMoney * 0.1
  }

  private get isMaxSecurityLevel() {
    return this.ns.getServerSecurityLevel(this.target) <= this.ns.getServerMinSecurityLevel(this.target)
  }

  private get isMaxMoney() {
    return this.ns.getServerMoneyAvailable(this.target) >= this.ns.getServerMaxMoney(this.target)
  }

  private get numOfWeakenThreadsNeeded() {
    const minSecurityLevel = this.ns.getServerMinSecurityLevel(this.target)

    let i = 1

    while (this.ns.getServerSecurityLevel(this.target) - this.ns.weakenAnalyze(i) > minSecurityLevel) {
      i++
    }

    return i
  }

  private get numOfGrowThreadsNeeded() {
    if (!this.isMaxSecurityLevel) {
      return 0
    }

    let growthFactor = this.maxMoney / this.availableMoney

    if (growthFactor === Infinity) {
      growthFactor = this.maxMoney
    }

    return Math.ceil(this.ns.growthAnalyze(this.target, growthFactor))
  }

  private get numOfHackThreadsNeeded() {
    if (!this.isMaxSecurityLevel || !this.isMaxMoney) {
      return 0
    }

    return Math.floor(this.ns.hackAnalyzeThreads(this.target, this.moneyThreshold))
  }

  private get totalAvailableThreads() {
    const maxRam = Math.max(this.weakenScriptSize, this.growScriptSize, this.hackScriptSize)

    let totalAvailableThreads = 0

    for (const server of this.servers) {
      totalAvailableThreads += Math.floor(this.getServerMaxRam(server) / maxRam)
    }

    return totalAvailableThreads
  }

  private get totalUsedThreads() {
    let totalUsedThreads = 0

    for (const server of this.servers) {
      totalUsedThreads += this.ns.getRunningScript('controller/weaken.js', server, this.target)?.threads || 0
      totalUsedThreads += this.ns.getRunningScript('controller/grow.js', server, this.target)?.threads || 0
      totalUsedThreads += this.ns.getRunningScript('controller/hack.js', server, this.target)?.threads || 0
    }

    return totalUsedThreads
  }

  private get flags() {
    return this.ns.flags([
      ['home', false],
      ['target', ''],
    ])
  }

  private get includeHomeServer() {
    return this.flags['home'] as boolean
  }

  private get target() {
    const target = this.flags['target']

    if (!target || typeof target !== 'string' || target.trim() === '') {
      throw new Error('Please provide a target server using --target argument')
    }

    return target.trim()
  }

  constructor(private readonly ns: NS) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.target // Validate target early
    this.servers = ServerList.get(this.ns)

    if (this.includeHomeServer) {
      this.servers.push('home')
    }

    // Setup: Copy scripts and nuke servers
    for (const server of this.servers) {
      this.ns.scp('controller/weaken.js', server)
      this.ns.scp('controller/grow.js', server)
      this.ns.scp('controller/hack.js', server)

      nuke(this.ns, server)
    }

    this.weakenScriptSize = this.ns.getScriptRam('controller/weaken.js')
    this.growScriptSize = this.ns.getScriptRam('controller/grow.js')
    this.hackScriptSize = this.ns.getScriptRam('controller/hack.js')
  }

  async run() {
    while (true) {
      const currentThreads = this.calculateCurrentThreads()

      const neededWeakenThreads = this.numOfWeakenThreadsNeeded - currentThreads.weaken
      const neededGrowThreads = this.numOfGrowThreadsNeeded - currentThreads.grow
      const neededHackThreads = this.numOfHackThreadsNeeded - currentThreads.hack

      this.ns.print(
        `Threads needed - Weaken: ${neededWeakenThreads}, Grow: ${neededGrowThreads}, Hack: ${neededHackThreads}`,
      )
      this.ns.print(`${this.totalUsedThreads}/${this.totalAvailableThreads} threads in use`)

      this.addWeakenThread(neededWeakenThreads)
      this.addGrowThread(neededGrowThreads)
      this.addHackThread(neededHackThreads)

      await this.ns.sleep(1000)
    }
  }

  private calculateCurrentThreads() {
    let weakenThreads = 0
    let growThreads = 0
    let hackThreads = 0

    for (const server of this.servers) {
      weakenThreads += this.ns.getRunningScript('controller/weaken.js', server, this.target)?.threads || 0
      growThreads += this.ns.getRunningScript('controller/grow.js', server, this.target)?.threads || 0
      hackThreads += this.ns.getRunningScript('controller/hack.js', server, this.target)?.threads || 0
    }

    return {
      weaken: weakenThreads,
      grow: growThreads,
      hack: hackThreads,
    }
  }

  private getServerMaxRam(server: string) {
    let ret = this.ns.getServerMaxRam(server)

    if (server === 'home') {
      ret -= 512 // Reserve some RAM for the home server to avoid issues
    }

    return ret
  }

  private getAvailableServerRam(server: string) {
    return this.getServerMaxRam(server) - this.ns.getServerUsedRam(server)
  }

  private possibleThreadsForScript(server: string, scriptSize: number) {
    return Math.floor(this.getAvailableServerRam(server) / scriptSize)
  }

  private addWeakenThread(threadsNeeded: number) {
    let threadsToAdd = Math.ceil(threadsNeeded)

    for (const server of this.servers) {
      if (threadsToAdd <= 0) {
        return
      }

      const threadsForServer = Math.min(
        this.possibleThreadsForScript(server, this.weakenScriptSize),
        this.totalAvailableThreads,
      )

      if (threadsForServer <= 0) {
        continue
      }

      this.ns.exec('controller/weaken.js', server, threadsForServer, this.target)
      threadsToAdd -= threadsForServer
      this.ns.print(`Added ${threadsForServer} weaken threads on ${server} targeting ${this.target}`)
    }
  }

  private addGrowThread(threadsNeeded: number) {
    let threadsToAdd = Math.ceil(threadsNeeded)

    for (const server of this.servers) {
      if (threadsToAdd <= 0) {
        return
      }

      const threadsForServer = Math.min(this.possibleThreadsForScript(server, this.growScriptSize), threadsToAdd)

      if (threadsForServer <= 0) {
        continue
      }

      this.ns.exec('controller/grow.js', server, threadsForServer, this.target)
      threadsToAdd -= threadsForServer
      this.ns.print(`Added ${threadsForServer} grow threads on ${server} targeting ${this.target}`)
    }
  }

  private addHackThread(threadsNeeded: number) {
    let threadsToAdd = Math.ceil(threadsNeeded)

    for (const server of this.servers) {
      if (threadsToAdd <= 0) {
        return
      }

      const threadsForServer = Math.min(this.possibleThreadsForScript(server, this.hackScriptSize), threadsToAdd)

      if (threadsForServer <= 0) {
        continue
      }

      this.ns.exec('controller/hack.js', server, threadsForServer, this.target)
      threadsToAdd -= threadsForServer
      this.ns.print(`Added ${threadsForServer} hack threads on ${server} targeting ${this.target}`)
    }
  }
}
