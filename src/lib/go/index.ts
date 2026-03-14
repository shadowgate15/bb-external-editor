import { GoBoard } from './board'

export type GoResult = Awaited<ReturnType<NS['go']['makeMove']>>

export async function playGo(ns: NS): Promise<GoResult> {
  let result: GoResult | undefined

  do {
    const board = GoBoard.fromNS(ns)

    const move = board.getMove()

    if (move === undefined) {
      // Pass turn if no moves are found
      result = await ns.go.passTurn()
    } else {
      // Play the selected move
      result = await ns.go.makeMove(move.x, move.y)
    }

    // Log opponent's next move, once it happens
    await ns.go.opponentNextTurn()

    await ns.asleep(200)

    // Keep looping as long as the opponent is playing moves
  } while (result?.type !== 'gameOver')

  return result
}
