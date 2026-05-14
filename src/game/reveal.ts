import { forEachNeighbor, inBounds } from './board'
import { generateBoard } from './generateBoard'
import { mulberry32 } from './rng'
import type { Cell, GameState } from './types'

type RevealResult = {
  next: GameState
  newlyRevealedSafe: number
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((c) => ({ ...c })))
}

function revealFlood(board: Cell[][], startRow: number, startCol: number): number {
  let newlyRevealedSafe = 0

  const stack: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }]
  const seen = new Set<number>()
  const cols = board[0]!.length

  while (stack.length > 0) {
    const cur = stack.pop()!
    if (!inBounds(board, cur.row, cur.col)) continue

    const key = cur.row * cols + cur.col
    if (seen.has(key)) continue
    seen.add(key)

    const cell = board[cur.row]![cur.col]!
    if (cell.state === 'revealed' || cell.state === 'flagged') continue
    if (cell.isMine) continue

    cell.state = 'revealed'
    newlyRevealedSafe++

    if (cell.adjacentMines === 0) {
      forEachNeighbor(board, cell.row, cell.col, (r, c) => {
        const n = board[r]![c]!
        if (n.state === 'covered' && !n.isMine) {
          stack.push({ row: r, col: c })
        }
      })
    }
  }

  return newlyRevealedSafe
}

export function revealCell(state: GameState, row: number, col: number): RevealResult {
  if (state.status === 'won' || state.status === 'lost') {
    return { next: state, newlyRevealedSafe: 0 }
  }

  // First reveal generates a new board using the state's seed to ensure determinism + safety.
  const board =
    state.status === 'ready'
      ? generateBoard(state.difficulty, row, col, mulberry32(state.seed))
      : state.board

  const nextBoard = cloneBoard(board)
  const cell = nextBoard[row]?.[col]
  if (!cell) return { next: state, newlyRevealedSafe: 0 }

  if (cell.state === 'flagged' || cell.state === 'revealed') {
    return { next: { ...state, board: nextBoard }, newlyRevealedSafe: 0 }
  }

  if (cell.isMine) {
    cell.state = 'revealed'
    cell.exploded = true
    return {
      next: {
        ...state,
        board: nextBoard,
        status: 'lost',
        endedAtMs: state.endedAtMs ?? Date.now(),
        score: 0,
      },
      newlyRevealedSafe: 0,
    }
  }

  const newlyRevealedSafe = revealFlood(nextBoard, row, col)
  const revealedSafeCount = state.revealedSafeCount + newlyRevealedSafe
  const totalSafe = state.difficulty.rows * state.difficulty.cols - state.difficulty.mines
  const won = revealedSafeCount >= totalSafe

  return {
    newlyRevealedSafe,
    next: {
      ...state,
      board: nextBoard,
      status: won ? 'won' : 'playing',
      revealedSafeCount,
      endedAtMs: won ? Date.now() : null,
    },
  }
}

/**
 * Chord: on a revealed numbered cell whose flagged-neighbour count equals its number,
 * reveal all unflagged neighbours. If a flag is wrong, the resulting mine reveal loses the game.
 */
export function chordCell(state: GameState, row: number, col: number): RevealResult {
  if (state.status !== 'playing') return { next: state, newlyRevealedSafe: 0 }

  const cell = state.board[row]?.[col]
  if (!cell || cell.state !== 'revealed' || cell.adjacentMines === 0) {
    return { next: state, newlyRevealedSafe: 0 }
  }

  let flaggedCount = 0
  forEachNeighbor(state.board, row, col, (r, c) => {
    if (state.board[r]![c]!.state === 'flagged') flaggedCount++
  })
  if (flaggedCount !== cell.adjacentMines) {
    return { next: state, newlyRevealedSafe: 0 }
  }

  const targets: Array<[number, number]> = []
  forEachNeighbor(state.board, row, col, (r, c) => {
    if (state.board[r]![c]!.state === 'covered') targets.push([r, c])
  })

  let cur = state
  let total = 0
  for (const [r, c] of targets) {
    if (cur.status === 'lost' || cur.status === 'won') break
    const res = revealCell(cur, r, c)
    cur = res.next
    total += res.newlyRevealedSafe
  }

  return { next: cur, newlyRevealedSafe: total }
}
