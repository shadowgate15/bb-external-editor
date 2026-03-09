export async function main(ns: NS) {
  const t = ns.formulas.reputation.calculateFavorToRep(150) - ns.formulas.reputation.calculateFavorToRep(146.654)
  ns.tprint(ns.formatNumber(t, 2))
}
