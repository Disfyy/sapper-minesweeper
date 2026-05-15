import { createEmptyBoard, forEachNeighbor } from './board'
import type { Cell, Difficulty } from './types'

const FIRST_REVEAL_SAFE_RADIUS = 1

function computeAdjacentMines(board: Cell[][]): void {
  for (const rowCells of board) {
    for (const cell of rowCells) {
      if (cell.isMine) {
        cell.adjacentMines = 0
        continue
      }
      let count = 0
      forEachNeighbor(board, cell.row, cell.col, (r, c) => {
        if (board[r]![c]!.isMine) count++
      })
      cell.adjacentMines = count
    }
  }
}

function createFirstRevealSafeZone(
  difficulty: Difficulty,
  safeRow: number,
  safeCol: number,
): Set<number> {
  const totalCells = difficulty.rows * difficulty.cols
  const maxSafeCells = Math.max(1, totalCells - difficulty.mines)
  const safeIndices = new Set<number>()

  const addIfAvailable = (row: number, col: number) => {
    if (safeIndices.size >= maxSafeCells) return
    if (row < 0 || col < 0 || row >= difficulty.rows || col >= difficulty.cols) return
    safeIndices.add(row * difficulty.cols + col)
  }

  addIfAvailable(safeRow, safeCol)

  for (let radius = 1; radius <= FIRST_REVEAL_SAFE_RADIUS; radius++) {
    for (let row = safeRow - radius; row <= safeRow + radius; row++) {
      for (let col = safeCol - radius; col <= safeCol + radius; col++) {
        if (Math.max(Math.abs(row - safeRow), Math.abs(col - safeCol)) !== radius) continue
        addIfAvailable(row, col)
      }
    }
  }

  return safeIndices
}

export function generateBoard(
  difficulty: Difficulty,
  safeRow: number,
  safeCol: number,
  rng: () => number = Math.random,
): Cell[][] {
  const board = createEmptyBoard(difficulty)

  const totalCells = difficulty.rows * difficulty.cols
  const safeIndices = createFirstRevealSafeZone(difficulty, safeRow, safeCol)
  const targetMines = Math.max(0, Math.min(difficulty.mines, totalCells - safeIndices.size))

  const mineIndices = new Set<number>()
  while (mineIndices.size < targetMines) {
    const idx = Math.floor(rng() * totalCells)
    if (safeIndices.has(idx)) continue
    mineIndices.add(idx)
  }

  for (const idx of mineIndices) {
    const row = Math.floor(idx / difficulty.cols)
    const col = idx % difficulty.cols
    board[row]![col]!.isMine = true
  }

  computeAdjacentMines(board)
  return board
}
