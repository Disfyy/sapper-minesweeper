import { computeFinalScore, computeSpeedScore } from './scoring'
import { toggleFlag } from './flag'
import { chordCell, revealCell } from './reveal'
import { createInitialState } from './state'
import type { Difficulty, GameState, Move } from './types'

export type GameAction =
  | { type: 'restart'; difficulty?: Difficulty; seed?: number }
  | { type: 'reveal'; row: number; col: number; nowMs: number }
  | { type: 'toggleFlag'; row: number; col: number; nowMs: number }
  | { type: 'chord'; row: number; col: number; nowMs: number }
  | { type: 'tick'; nowMs: number }
  | { type: 'timeUp'; nowMs: number }
  | { type: 'loadAnalysis'; state: GameState }

function isSpeed(state: GameState): boolean {
  return state.difficulty.slug === 'speed'
}

function appendMove(state: GameState, move: Move): GameState {
  return { ...state, moves: [...state.moves, move] }
}

function timeOffset(state: GameState, nowMs: number): number {
  return state.startedAtMs ? Math.max(0, nowMs - state.startedAtMs) : 0
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'restart': {
      return createInitialState(action.difficulty ?? state.difficulty, action.seed)
    }
    case 'loadAnalysis': {
      return action.state
    }
    case 'toggleFlag': {
      const next = toggleFlag(state, action.row, action.col)
      if (next.flagsPlaced === state.flagsPlaced) return next
      return appendMove(next, {
        a: 'f',
        r: action.row,
        c: action.col,
        t: timeOffset(state, action.nowMs),
      })
    }
    case 'reveal': {
      if (state.status === 'won' || state.status === 'lost') return state

      const wasReady = state.status === 'ready'
      const startedAtMs = state.startedAtMs ?? action.nowMs
      const revealed = revealCell(
        wasReady ? { ...state, startedAtMs } : state,
        action.row,
        action.col,
      )

      const move: Move = {
        a: 'r',
        r: action.row,
        c: action.col,
        t: wasReady ? 0 : action.nowMs - startedAtMs,
      }

      // No-op click (cell already revealed or flagged) — don't record.
      if (revealed.newlyRevealedSafe === 0 && revealed.next.status !== 'lost') {
        return revealed.next
      }

      if (revealed.next.status === 'lost') {
        return appendMove(
          { ...revealed.next, startedAtMs, endedAtMs: action.nowMs, score: 0 },
          move,
        )
      }

      const scoreFromReveals = state.score + revealed.newlyRevealedSafe * 10
      let next: GameState = { ...revealed.next, startedAtMs, score: scoreFromReveals }

      if (next.status === 'won') {
        const durationMs = action.nowMs - startedAtMs
        const finalScore = isSpeed(next)
          ? computeSpeedScore({
              outcome: 'won',
              revealedSafeCount: next.revealedSafeCount,
              durationMs,
            })
          : computeFinalScore({
              status: 'won',
              revealedSafeCount: next.revealedSafeCount,
              elapsedSeconds: durationMs / 1000,
            })
        next = {
          ...next,
          endedAtMs: action.nowMs,
          score: finalScore,
        }
      }

      return appendMove(next, move)
    }
    case 'chord': {
      if (state.status !== 'playing') return state
      const result = chordCell(state, action.row, action.col)
      if (result.newlyRevealedSafe === 0 && result.next.status !== 'lost') return state

      const move: Move = {
        a: 'c',
        r: action.row,
        c: action.col,
        t: timeOffset(state, action.nowMs),
      }

      if (result.next.status === 'lost') {
        return appendMove({ ...result.next, endedAtMs: action.nowMs, score: 0 }, move)
      }

      let next: GameState = {
        ...result.next,
        score: state.score + result.newlyRevealedSafe * 10,
      }

      if (next.status === 'won') {
        const durationMs = action.nowMs - (state.startedAtMs ?? action.nowMs)
        const finalScore = isSpeed(next)
          ? computeSpeedScore({
              outcome: 'won',
              revealedSafeCount: next.revealedSafeCount,
              durationMs,
            })
          : computeFinalScore({
              status: 'won',
              revealedSafeCount: next.revealedSafeCount,
              elapsedSeconds: durationMs / 1000,
            })
        next = {
          ...next,
          endedAtMs: action.nowMs,
          score: finalScore,
        }
      }

      return appendMove(next, move)
    }
    case 'tick': {
      if (state.status !== 'playing') return state
      return state
    }
    case 'timeUp': {
      if (state.status !== 'playing') return state
      if (!isSpeed(state) || !state.startedAtMs) return state
      const durationMs = action.nowMs - state.startedAtMs
      return {
        ...state,
        status: 'lost',
        endedAtMs: action.nowMs,
        score: computeSpeedScore({
          outcome: 'timeUp',
          revealedSafeCount: state.revealedSafeCount,
          durationMs,
        }),
      }
    }
    default: {
      return state
    }
  }
}

export function getElapsedSeconds(state: GameState, nowMs: number): number {
  if (!state.startedAtMs) return 0
  const end = state.endedAtMs ?? nowMs
  return Math.max(0, (end - state.startedAtMs) / 1000)
}
