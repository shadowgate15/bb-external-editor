export async function main(ns: NS) {
  ns.ui.openTail()

  try {
    ns.corporation.getDivision('blah')
  } catch (e) {
    ns.tprint(Object.keys(e))

    throw e
  }
}
