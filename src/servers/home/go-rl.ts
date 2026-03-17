import { GoOpponent } from '@ns'

import { GoResult } from '@/lib/go'

const BOARD_SIZE: 5 | 7 | 9 | 13 = 5
const OPPONENT: GoOpponent = 'Netburners'

type GoGameState = {
  currentPlayer: 'White' | 'Black' | 'None'
  whiteScore: number
  blackScore: number
  previousMove: [number, number] | null
  komi: number
  bonusCycles: number
}

interface ResetSend {
  type: 'reset'
}
interface ResetRecv {
  board: string[]
  current_player: 'black' | 'white'
  legal_moves: boolean[]
}

// step
interface StepSend {
  type: 'step'
  action: number
}
interface StepRecv {
  board: string[]
  reward: number
  done: boolean
  current_player: 'black' | 'white'
  legal_moves: boolean[]
}

type Send = ResetSend | StepSend
type Recv = ResetRecv | StepRecv

export async function main(ns: NS) {
  ns.disableLog('ALL')
  ns.ui.openTail()
  await ns.asleep(100)

  const socket = new WebSocket('ws://localhost:8765')

  socket.addEventListener('open', () => {
    ns.print('Connected to socket')
  })

  let result: GoResult | undefined

  const getCurrentPlayer = () => ns.go.getCurrentPlayer().toLowerCase() as 'black' | 'white'

  const getLegalMoves = () =>
    ns.go.analysis
      .getValidMoves()
      .reduce((prev, curr) => prev.concat(curr), [] as boolean[])
      .concat(true)

  let previousGameState: GoGameState | undefined
  const getReward = () => {
    const gameState = ns.go.getGameState()

    try {
      if (gameState.currentPlayer !== 'None') {
        const blackDiff = gameState.blackScore - (previousGameState?.blackScore ?? 0)
        const whiteDiff = gameState.whiteScore - (previousGameState?.whiteScore ?? 0)

        return (blackDiff - whiteDiff) * 0.02
      }

      if (gameState.blackScore > gameState.whiteScore) {
        return 1
      } else {
        return -1
      }
    } finally {
      previousGameState = gameState
    }
  }

  const send = <T extends Recv>(data: T) => {
    ns.print('Sending: ', data)

    socket.send(JSON.stringify(data))
  }

  socket.addEventListener('message', async (e) => {
    const data = JSON.parse(e.data) as Send
    ns.print(`Received: `, data)

    if (data.type === 'reset') {
      const board = ns.go.resetBoardState(OPPONENT, BOARD_SIZE)
      previousGameState = undefined

      send<ResetRecv>({
        board: board,
        current_player: getCurrentPlayer(),
        legal_moves: getLegalMoves(),
      })
    } else if (data.type === 'step') {
      const move = getPositionFromAction(data.action)

      if (move === null) {
        result = await ns.go.passTurn()
      } else {
        result = await ns.go.makeMove(move[0], move[1])
      }

      send<StepRecv>({
        board: ns.go.getBoardState(),
        current_player: getCurrentPlayer(),
        legal_moves: getLegalMoves(),
        reward: getReward(),
        done: result?.type === 'gameOver',
      })
    }
  })

  ns.atExit(() => {
    socket.close()
  })

  await new Promise<void>((resolve) => {
    socket.addEventListener('close', () => {
      resolve()
    })
  })
}

function getPositionFromAction(action: number): [x: number, y: number] | null {
  const PASS_INDEX = BOARD_SIZE * BOARD_SIZE

  if (action === PASS_INDEX) {
    return null
  }

  const row = Math.floor(action / BOARD_SIZE)
  const col = action % BOARD_SIZE

  return [row, col]
}

function getActionFromResult(result: GoResult) {
  return result.x * BOARD_SIZE + result.y
}
