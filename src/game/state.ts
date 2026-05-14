import { createEmptyBoard } from './board'
import { randomSeed } from './rng'
import type { Difficulty, GameState } from './types'

export function createInitialState(difficulty: Difficulty, seed?: number): GameState {
  return {
    difficulty,
    board: createEmptyBoard(difficulty),
    status: 'ready',
    flagsPlaced: 0,
    revealedSafeCount: 0,
    startedAtMs: null,
    endedAtMs: null,
    score: 0,
    seed: seed ?? randomSeed(),
    moves: [],
  }
}
