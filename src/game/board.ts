import type { Cell, Difficulty } from './types'

export function createEmptyBoard(difficulty: Difficulty): Cell[][] {
  const board: Cell[][] = []
  for (let row = 0; row < difficulty.rows; row++) {
    const rowCells: Cell[] = []
    for (let col = 0; col < difficulty.cols; col++) {
      rowCells.push({
        row,
        col,
        isMine: false,
        adjacentMines: 0,
        state: 'covered',
      })
    }
    board.push(rowCells)
  }
  return board
}

export function inBounds(board: Cell[][], row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < board.length && col < board[0]!.length
}

export function forEachNeighbor(
  board: Cell[][],
  row: number,
  col: number,
  fn: (r: number, c: number) => void,
): void {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const r = row + dr
      const c = col + dc
      if (!inBounds(board, r, c)) continue
      fn(r, c)
    }
  }
}

