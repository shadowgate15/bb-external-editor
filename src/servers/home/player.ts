export async function main(ns: NS) {
  const player = ns.getPlayer()

  ns.tprint(`Karma: ${player.karma}`)
  ns.tprint(`Kills: ${player.numPeopleKilled}`)
}
