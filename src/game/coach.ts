import type { Cell } from './types'

export type CoachPick = { row: number; col: number; prob: number }
export type CoachHint = { safe: CoachPick | null; mine: CoachPick | null }

/**
 * Probability-based hint. NOT a perfect solver — single-pass constraint
 * aggregation (no recursion / no full CSP). Cheap (O(rows × cols × 9)), good
 * enough to surface the obviously-safe and obviously-mined cells.
 *
 * For each revealed numbered cell with N adjacent mines, K of those mines
 * already flagged, and U adjacent covered-non-flagged neighbors, every cell
 * in U gets a local probability (N - K) / U.length. We aggregate per covered
 * cell by max (used to pick the mine) and min (used to pick the safe cell).
 * Cells with no revealed-number neighbor fall back to global mine density.
 */
export function computeMineProbabilities(
  board: Cell[][],
  totalMines: number,
  flagsPlaced: number,
): CoachHint {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  if (rows === 0 || cols === 0) return { safe: null, mine: null }

  // Per-cell aggregates. NaN = no constraint touched yet.
  const minProb: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(NaN))
  const maxProb: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(NaN))

  const inBounds = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols

  let coveredCount = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r]![c]!.state === 'covered') coveredCount++
    }
  }

  // Walk revealed numbered cells; emit a local probability for each covered neighbor.
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
      for (const { r: cr, c: cc } of covered) {
        const prevMin = minProb[cr]![cc]!
        const prevMax = maxProb[cr]![cc]!
        minProb[cr]![cc] = Number.isNaN(prevMin) ? localProb : Math.min(prevMin, localProb)
        maxProb[cr]![cc] = Number.isNaN(prevMax) ? localProb : Math.max(prevMax, localProb)
      }
    }
  }

  // Fallback density for isolated covered cells (no revealed-number neighbor).
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
      // Safe pick: lowest mine-probability cell, ties broken by reading order.
      if (!safe || minP < safe.prob) safe = { row: r, col: c, prob: minP }
      // Mine pick: highest mine-probability cell.
      if (!mine || maxP > mine.prob) mine = { row: r, col: c, prob: maxP }
    }
  }

  // Avoid degenerate hints — only return picks meaningfully different from random.
  if (safe && safe.prob >= 0.5) safe = null
  if (mine && mine.prob <= 0.5) mine = null
  // Avoid same cell flagged as both.
  if (safe && mine && safe.row === mine.row && safe.col === mine.col) {
    if (mine.prob >= 1 - safe.prob) safe = null
    else mine = null
  }

  return { safe, mine }
}
