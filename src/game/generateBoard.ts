import { createEmptyBoard, forEachNeighbor } from './board'
import type { Cell, Difficulty } from './types'

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

export function generateBoard(
  difficulty: Difficulty,
  safeRow: number,
  safeCol: number,
  rng: () => number = Math.random,
): Cell[][] {
  const board = createEmptyBoard(difficulty)

  const totalCells = difficulty.rows * difficulty.cols
  const safeIndex = safeRow * difficulty.cols + safeCol

  const mineIndices = new Set<number>()
  while (mineIndices.size < difficulty.mines) {
    const idx = Math.floor(rng() * totalCells)
    if (idx === safeIndex) continue
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
