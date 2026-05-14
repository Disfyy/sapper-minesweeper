import type { GameStatus } from './types'
import { SPEED_TIME_LIMIT_MS } from './types'

export function computeFinalScore(params: {
  status: GameStatus
  revealedSafeCount: number
  elapsedSeconds: number
}): number {
  if (params.status !== 'won') return 0
  const base = params.revealedSafeCount * 10
  const completionBonus = 500
  const timePenalty = Math.max(0, Math.floor(params.elapsedSeconds))
  return Math.max(0, base + completionBonus - timePenalty)
}

/**
 * Speed mode (2-minute sprint) scoring.
 * - Won: cells * 10 + leftover-seconds * 5 bonus.
 * - Time-up: cells * 10 (partial credit for the cells you cleared in 2 min).
 * - Mine hit: 0 (same risk as normal mode).
 */
export function computeSpeedScore(params: {
  outcome: 'won' | 'timeUp' | 'mine'
  revealedSafeCount: number
  durationMs: number
}): number {
  if (params.outcome === 'mine') return 0
  const base = params.revealedSafeCount * 10
  if (params.outcome === 'timeUp') return base
  // won
  const leftoverSeconds = Math.max(0, (SPEED_TIME_LIMIT_MS - params.durationMs) / 1000)
  return Math.floor(base + leftoverSeconds * 5)
}

