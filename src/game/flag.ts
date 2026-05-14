import type { CellState, GameState } from './types'

export function toggleFlag(state: GameState, row: number, col: number): GameState {
  if (state.status === 'won' || state.status === 'lost') return state

  const cell = state.board[row]?.[col]
  if (!cell) return state
  if (cell.state === 'revealed') return state

  const board = state.board.map((r, rIdx) =>
    rIdx === row
      ? r.map((c, cIdx) => {
          if (cIdx !== col) return c
          const nextState: CellState = c.state === 'flagged' ? 'covered' : 'flagged'
          return { ...c, state: nextState }
        })
      : r,
  )

  const wasFlagged = cell.state === 'flagged'
  const flagsPlaced = wasFlagged ? state.flagsPlaced - 1 : state.flagsPlaced + 1

  return { ...state, board, flagsPlaced, status: state.status === 'ready' ? 'ready' : 'playing' }
}

