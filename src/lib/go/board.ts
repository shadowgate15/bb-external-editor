import once from 'lodash/once'
import random from 'lodash/random'

export const PlayerBoardState = 'X' as const
export const OpponentBoardState = 'O' as const
export const EmptyBoardState = '.' as const
export const DeadBoardState = '#' as const

export type BoardState =
  | typeof PlayerBoardState
  | typeof OpponentBoardState
  | typeof EmptyBoardState
  | typeof DeadBoardState

export class GoBoard {
  static fromNS(ns: NS) {
    const board = ns.go.getBoardState()
    const validMoves = ns.go.analysis.getValidMoves()
    const chains = ns.go.analysis.getChains()

    const size = board[0].length

    const boardPoints: BoardPoint[] = []

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const state = board[x][y] as BoardState
        const chainId = chains[x][y]
        const validMove = validMoves[x][y] === true

        boardPoints.push(new BoardPoint(boardPoints, x, y, state, chainId, validMove))
      }
    }

    return new GoBoard(boardPoints)
  }

  constructor(public readonly boardPoints: BoardPoint[]) {}

  getMove() {
    return this.getDefenseMove() ?? this.getCaptureMove() ?? this.getNetworkExpansionMove() ?? this.getRandomMove()
  }

  getRandomMove() {
    const moveOptions: BoardPoint[] = this.boardPoints.filter((point) => point.validMove && !point.reservedSpace())

    return moveOptions[random(0, moveOptions.length - 1)]
  }

  getNetworkExpansionMove() {
    const moveOptions: BoardPoint[] = this.boardPoints.filter(
      (point) => point.validMove && !point.reservedSpace() && point.hasFriendlyAdjacentPoints(),
    )

    let bestMove: BoardPoint = moveOptions[0]

    for (const move of moveOptions) {
      if (bestMove.emptyAdjacentPoints().length < move.emptyAdjacentPoints().length) {
        bestMove = move
      }
    }

    return bestMove
  }

  getCaptureMove() {
    const moveOptions: BoardPoint[] = this.boardPoints.filter(
      (point) =>
        point.validMove &&
        point.adjacentPointsWithOneLiberty().some((adjacentPoint) => adjacentPoint.state === OpponentBoardState),
    )

    return moveOptions[random(0, moveOptions.length - 1)]
  }

  getDefenseMove() {
    const moveOptions: BoardPoint[] = this.boardPoints
      .filter(
        (point) =>
          point.validMove &&
          point.adjacentPointsWithOneLiberty().some((adjacentPoint) => adjacentPoint.state === PlayerBoardState),
      )
      // Ensure the new move will not immediately allow the opponent to capture
      .filter(
        (point) =>
          point.emptyAdjacentPoints().length >= 2 &&
          point.friendlyAdjacentPoints().some((adjacentPoint) => adjacentPoint.liberty() >= 3),
      )

    return moveOptions[random(0, moveOptions.length - 1)]
  }
}

export class BoardPoint {
  constructor(
    private readonly boardPoints: BoardPoint[],
    public readonly x: number,
    public readonly y: number,
    public readonly state: BoardState,
    public readonly chainId: number | null,
    public readonly validMove: boolean,
  ) {}

  readonly reservedSpace = once(() => this.x % 2 === 1 && this.y % 2 === 1)

  readonly north = once(() => this.boardPoints.find((point) => point.x === this.x && point.y === this.y - 1))

  readonly south = once(() => this.boardPoints.find((point) => point.x === this.x && point.y === this.y + 1))

  readonly west = once(() => this.boardPoints.find((point) => point.x === this.x - 1 && point.y === this.y))

  readonly east = once(() => this.boardPoints.find((point) => point.x === this.x + 1 && point.y === this.y))

  readonly adjacentPoints = once(
    () => [this.north(), this.south(), this.west(), this.east()].filter(Boolean) as BoardPoint[],
  )

  readonly friendlyAdjacentPoints = once(() =>
    this.adjacentPoints().filter((point) => point.state === PlayerBoardState),
  )

  readonly emptyAdjacentPoints = once(() => this.adjacentPoints().filter((point) => point.state === EmptyBoardState))

  readonly adjacentPointsWithOneLiberty = once(() => this.adjacentPoints().filter((point) => point.liberty() === 1))

  readonly hasFriendlyAdjacentPoints = once(() => this.friendlyAdjacentPoints().length > 0)

  readonly hasFriendlyAdjacentPointsInDifferentChain = once(
    () =>
      this.hasFriendlyAdjacentPoints() && this.friendlyAdjacentPoints().some((point) => point.chainId !== this.chainId),
  )

  readonly liberty = once(() => {
    if (this.state === EmptyBoardState || this.state === DeadBoardState) return -1

    const emptyPointsConnectedToChain = new Set(
      this.pointsInSameChain()
        .map((point) => point.emptyAdjacentPoints())
        .flat(),
    )

    return emptyPointsConnectedToChain.size
  })

  readonly pointsInSameChain = once(() => this.boardPoints.filter((point) => point.chainId === this.chainId))
}
