export async function main(ns: NS) {
  ns.exec('zeusd.js', 'corporation', {
    preventDuplicates: true,
  })

  ns.toast('Started zeusd.js')
}
