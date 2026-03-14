import { GoOpponent } from '@ns'

import { playGo } from '@/lib/go'

const BOARD_SIZE: 5 | 7 | 9 | 13 = 7

const ALL_OPPONENTS: GoOpponent[] = ['Netburners', 'Slum Snakes', 'The Black Hand', 'Tetrads', 'Daedalus', 'Illuminati']

export async function main(ns: NS) {
  ns.ui.openTail()
  ns.disableLog('ALL')

  const runningScript = ns.getRunningScript('go.js')

  if (runningScript && runningScript.pid !== ns.pid) {
    ns.kill(runningScript.pid)
  }

  const getBestOpponent = () => {
    const opponents = ALL_OPPONENTS.map((opponent) => ({ opponent, stats: ns.go.analysis.getStats()[opponent] }))

    let bestOpponent = opponents[0]

    for (const { opponent, stats } of opponents) {
      const bestOpponentBonus = bestOpponent.stats?.bonusPercent ?? 0
      const opponentBonus = stats?.bonusPercent ?? 0

      if (bestOpponentBonus > opponentBonus) {
        bestOpponent = { opponent, stats }
      }
    }

    return bestOpponent.opponent
  }

  ns.print('Starting Go player script...')

  let opponent = ns.go.getOpponent()

  if (ns.go.getGameState().currentPlayer === 'None') {
    opponent = getBestOpponent()

    ns.go.resetBoardState(opponent, BOARD_SIZE)
  }

  while (true) {
    await playGo(ns)

    ns.print('Game over! Starting a new game...')
    ns.print(ns.go.analysis.getStats()[opponent])

    opponent = getBestOpponent()

    ns.go.resetBoardState(opponent, BOARD_SIZE)
  }
}
