import { gameReducer } from '../../game/game'
import { createInitialState } from '../../game/state'
import type { Difficulty, GameState, Move } from '../../game/types'

/**
 * Replay a recorded move log to the Nth step (default: all).
 * The resulting GameState is suitable for read-only rendering via <Board />.
 * Uses synthetic timestamps so the reducer's timer/scoring logic is internally consistent.
 */
export function replayMoves(
  difficulty: Difficulty,
  seed: number,
  moves: Move[],
  upTo?: number,
): GameState {
  let state = createInitialState(difficulty, seed)
  const limit = upTo ?? moves.length
  for (let i = 0; i < limit && i < moves.length; i++) {
    const m = moves[i]!
    const nowMs = m.t // baseline 0 + offset
    if (m.a === 'r') {
      state = gameReducer(state, { type: 'reveal', row: m.r, col: m.c, nowMs })
    } else if (m.a === 'f') {
      state = gameReducer(state, { type: 'toggleFlag', row: m.r, col: m.c, nowMs })
    } else if (m.a === 'c') {
      state = gameReducer(state, { type: 'chord', row: m.r, col: m.c, nowMs })
    }
  }
  return state
}
