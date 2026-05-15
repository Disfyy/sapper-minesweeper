import type { Cell } from './types'

export type CoachReasonKind =
  /** The numbered neighbor's mine quota is satisfied by flags, so all other covered neighbors are safe. */
  | 'allMinesFlagged'
  /** The numbered neighbor still needs N mines and has exactly N covered neighbors — they must all be mines. */
  | 'allCoveredAreMines'
  /** Constraint-implied probability — safe because driving cell shows low local mine ratio. */
  | 'lowLocalProb'
  /** Constraint-implied probability — mine because driving cell shows high local mine ratio. */
  | 'highLocalProb'
  /** No revealed-number neighbor; conclusion is global mine density only. */
  | 'globalDensity'

export type CoachReason = {
  kind: CoachReasonKind
  /** The revealed numbered cell that drove the conclusion (omitted for globalDensity). */
  srcRow?: number
  srcCol?: number
  /** The number shown on the source cell (omitted for globalDensity). */
  srcNumber?: number
  flagsAdj?: number
  coveredAdj?: number
}

export type CoachPick = {
  row: number
  col: number
  prob: number
  reason: CoachReason
}
export type CoachHint = { safe: CoachPick | null; mine: CoachPick | null }

type Constraint = {
  srcRow: number
  srcCol: number
  srcNumber: number
  flagsAdj: number
  coveredAdj: number
  prob: number
}

function pickReasonForSafe(constraint: Constraint): CoachReason {
  // Mines all already flagged → every remaining covered neighbor is safe.
  if (constraint.srcNumber - constraint.flagsAdj === 0) {
    return {
      kind: 'allMinesFlagged',
      srcRow: constraint.srcRow,
      srcCol: constraint.srcCol,
      srcNumber: constraint.srcNumber,
      flagsAdj: constraint.flagsAdj,
      coveredAdj: constraint.coveredAdj,
    }
  }
  return {
    kind: 'lowLocalProb',
    srcRow: constraint.srcRow,
    srcCol: constraint.srcCol,
    srcNumber: constraint.srcNumber,
    flagsAdj: constraint.flagsAdj,
    coveredAdj: constraint.coveredAdj,
  }
}

function pickReasonForMine(constraint: Constraint): CoachReason {
  // Remaining mines exactly fill the covered neighbors → all of them are mines.
  if (constraint.srcNumber - constraint.flagsAdj === constraint.coveredAdj) {
    return {
      kind: 'allCoveredAreMines',
      srcRow: constraint.srcRow,
      srcCol: constraint.srcCol,
      srcNumber: constraint.srcNumber,
      flagsAdj: constraint.flagsAdj,
      coveredAdj: constraint.coveredAdj,
    }
  }
  return {
    kind: 'highLocalProb',
    srcRow: constraint.srcRow,
    srcCol: constraint.srcCol,
    srcNumber: constraint.srcNumber,
    flagsAdj: constraint.flagsAdj,
    coveredAdj: constraint.coveredAdj,
  }
}

/**
 * Probability-based hint. NOT a perfect solver — single-pass constraint
 * aggregation (no recursion / no full CSP). Cheap (O(rows × cols × 9)), good
 * enough to surface the obviously-safe and obviously-mined cells.
 *
 * For each revealed numbered cell with N adjacent mines, K of those mines
 * already flagged, and U adjacent covered-non-flagged neighbors, every cell
 * in U gets a local probability (N - K) / U.length. We aggregate per covered
 * cell by max (used to pick the mine) and min (used to pick the safe cell)
 * AND remember which constraint produced the min/max so we can explain it.
 */
export function computeMineProbabilities(
  board: Cell[][],
  totalMines: number,
  flagsPlaced: number,
): CoachHint {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  if (rows === 0 || cols === 0) return { safe: null, mine: null }

  const minProb: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(NaN))
  const maxProb: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(NaN))
  const minSrc: Array<Array<Constraint | null>> = Array.from({ length: rows }, () =>
    new Array<Constraint | null>(cols).fill(null),
  )
  const maxSrc: Array<Array<Constraint | null>> = Array.from({ length: rows }, () =>
    new Array<Constraint | null>(cols).fill(null),
  )

  const inBounds = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols

  let coveredCount = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r]![c]!.state === 'covered') coveredCount++
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r]![c]!
      if (cell.state !== 'revealed' || cell.adjacentMines === 0) continue
      let flagsAdj = 0
      const covered: Array<{ r: number; c: number }> = []
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr
          const nc = c + dc
          if (!inBounds(nr, nc)) continue
          const n = board[nr]![nc]!
          if (n.state === 'flagged') flagsAdj++
          else if (n.state === 'covered') covered.push({ r: nr, c: nc })
        }
      }
      if (covered.length === 0) continue
      const remaining = cell.adjacentMines - flagsAdj
      const localProb = Math.max(0, Math.min(1, remaining / covered.length))
      const constraint: Constraint = {
        srcRow: r,
        srcCol: c,
        srcNumber: cell.adjacentMines,
        flagsAdj,
        coveredAdj: covered.length,
        prob: localProb,
      }
      for (const { r: cr, c: cc } of covered) {
        const prevMin = minProb[cr]![cc]!
        const prevMax = maxProb[cr]![cc]!
        if (Number.isNaN(prevMin) || localProb < prevMin) {
          minProb[cr]![cc] = localProb
          minSrc[cr]![cc] = constraint
        }
        if (Number.isNaN(prevMax) || localProb > prevMax) {
          maxProb[cr]![cc] = localProb
          maxSrc[cr]![cc] = constraint
        }
      }
    }
  }

  const unflaggedCovered = Math.max(0, coveredCount)
  const fallback =
    unflaggedCovered > 0
      ? Math.max(0, Math.min(1, (totalMines - flagsPlaced) / unflaggedCovered))
      : 0.5

  let safe: CoachPick | null = null
  let mine: CoachPick | null = null

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r]![c]!
      if (cell.state !== 'covered') continue
      const minP = Number.isNaN(minProb[r]![c]!) ? fallback : minProb[r]![c]!
      const maxP = Number.isNaN(maxProb[r]![c]!) ? fallback : maxProb[r]![c]!
      if (!safe || minP < safe.prob) {
        const src = minSrc[r]![c]
        safe = {
          row: r,
          col: c,
          prob: minP,
          reason: src ? pickReasonForSafe(src) : { kind: 'globalDensity' },
        }
      }
      if (!mine || maxP > mine.prob) {
        const src = maxSrc[r]![c]
        mine = {
          row: r,
          col: c,
          prob: maxP,
          reason: src ? pickReasonForMine(src) : { kind: 'globalDensity' },
        }
      }
    }
  }

  if (safe && safe.prob >= 0.5) safe = null
  if (mine && mine.prob <= 0.5) mine = null
  if (safe && mine && safe.row === mine.row && safe.col === mine.col) {
    if (mine.prob >= 1 - safe.prob) safe = null
    else mine = null
  }

  return { safe, mine }
}
