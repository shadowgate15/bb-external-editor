export async function main(ns: NS) {
  ns.ui.openTail()

  ns.tprint(ns.hasRootAccess('home'))
}
