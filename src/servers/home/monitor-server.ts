import { NS } from '@ns'
import { ServerList } from './deploy/server-list'

export async function main(ns: NS) {
  ns.disableLog('ALL')

  const target = ns.args[0]

  if (!target || typeof target !== 'string') {
    throw new Error('Please provide a target server as an argument')
  }

  ns.ui.openTail()

  while (true) {
    ns.clearLog()
    ns.print(`Monitoring server: ${target}`)
    ns.print('-----------------------------')

    ns.print(`Money Available: ${ns.formatNumber(ns.getServerMoneyAvailable(target))}`)
    ns.print(`Money Max: ${ns.formatNumber(ns.getServerMaxMoney(target))}`)
    ns.print('-----------------------------')

    ns.print(`Security Level: ${ns.formatNumber(ns.getServerSecurityLevel(target))}`)
    ns.print(`Min Security Level: ${ns.formatNumber(ns.getServerMinSecurityLevel(target))}`)
    ns.print('-----------------------------')

    ns.print(`Weaken Time: ${ns.tFormat(ns.getWeakenTime(target))}`)
    ns.print(`Grow Time: ${ns.tFormat(ns.getGrowTime(target))}`)
    ns.print(`Hack Time: ${ns.tFormat(ns.getHackTime(target))}`)
    ns.print('-----------------------------')

    const activeScripts = getActiveScripts(ns, target)

    ns.print(`Active Weaken Scripts: ${activeScripts.weaken}`)
    ns.print(`Active Grow Scripts: ${activeScripts.grow}`)
    ns.print(`Active Hack Scripts: ${activeScripts.hack}`)

    await ns.asleep(1000)
  }
}

function getActiveScripts(ns: NS, target: string) {
  const servers = ServerList.get(ns)

  const activeScripts = {
    weaken: 0,
    grow: 0,
    hack: 0,
  }

  for (const server of servers) {
    const runningScripts = ns.ps(server)

    activeScripts.weaken += runningScripts
      .filter((script) => script.filename === 'controller/weaken.js' && script.args[0] === target)
      .reduce((acc, script) => acc + script.threads, 0)
    activeScripts.grow += runningScripts
      .filter((script) => script.filename === 'controller/grow.js' && script.args[0] === target)
      .reduce((acc, script) => acc + script.threads, 0)

    activeScripts.hack += runningScripts
      .filter((script) => script.filename === 'controller/hack.js' && script.args[0] === target)
      .reduce((acc, script) => acc + script.threads, 0)
  }

  return activeScripts
}
