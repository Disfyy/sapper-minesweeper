export type CellState = 'covered' | 'revealed' | 'flagged'

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost'

export type Difficulty = {
  rows: number
  cols: number
  mines: number
  /** Optional preset slug — e.g. 'beginner' | 'intermediate' | 'expert' */
  slug?: string
}

export type Cell = {
  row: number
  col: number
  isMine: boolean
  adjacentMines: number
  state: CellState
  exploded?: boolean
}

export type MoveAction = 'r' | 'f' | 'c'

export type Move = {
  /** 'r' reveal · 'f' flag toggle · 'c' chord */
  a: MoveAction
  r: number
  c: number
  /** ms since startedAtMs (0 on the first reveal that starts the clock) */
  t: number
}

export type GameState = {
  difficulty: Difficulty
  board: Cell[][]
  status: GameStatus
  flagsPlaced: number
  revealedSafeCount: number
  startedAtMs: number | null
  endedAtMs: number | null
  score: number
  /** Seed used for board generation. Server-issued for ranked play; local for guest. */
  seed: number
  /** Append-only log of accepted moves. */
  moves: Move[]
}

export const BEGINNER_DIFFICULTY: Difficulty = { rows: 9, cols: 9, mines: 10, slug: 'beginner' }
export const INTERMEDIATE_DIFFICULTY: Difficulty = {
  rows: 16,
  cols: 16,
  mines: 40,
  slug: 'intermediate',
}
export const EXPERT_DIFFICULTY: Difficulty = { rows: 16, cols: 30, mines: 99, slug: 'expert' }
export const SPEED_DIFFICULTY: Difficulty = { rows: 9, cols: 9, mines: 10, slug: 'speed' }

export const SPEED_TIME_LIMIT_MS = 120_000

export const DIFFICULTY_PRESETS: Record<string, Difficulty> = {
  beginner: BEGINNER_DIFFICULTY,
  intermediate: INTERMEDIATE_DIFFICULTY,
  expert: EXPERT_DIFFICULTY,
  speed: SPEED_DIFFICULTY,
}
