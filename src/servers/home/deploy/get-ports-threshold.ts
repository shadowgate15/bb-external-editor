import { NS } from '@ns'

export function getPortsThreshold(ns: NS) {
  let i = 0

  for (const file of ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe']) {
    if (ns.fileExists(file, 'home')) {
      i++
    }
  }

  return i
}
