export async function main(ns: NS) {
  const script = ns.getRunningScript('zeusd.js', 'corporation')

  if (script) {
    ns.kill(script.pid)
  }

  ns.toast('Killed zeusd.js')
}
