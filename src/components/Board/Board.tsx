import { useEffect, useRef } from 'react'
import type { CoachHint } from '../../game/coach'
import type { Cell, GameStatus } from '../../game/types'
import { CellView } from '../Cell/CellView'
import styles from './Board.module.css'

type Focus = { row: number; col: number }

export function Board(props: {
  board: Cell[][]
  status: GameStatus
  focus: Focus
  setFocus: (f: Focus) => void
  flagMode?: boolean
  hintCells?: CoachHint | null
  onReveal: (cell: Cell) => void
  onToggleFlag: (cell: Cell) => void
  onChord?: (cell: Cell) => void
}) {
  const rows = props.board.length
  const cols = props.board[0]?.length ?? 0
  const gridRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLButtonElement>(
      `button[data-row="${props.focus.row}"][data-col="${props.focus.col}"]`,
    )
    el?.focus()
  }, [props.focus.col, props.focus.row])

  const moveFocus = (dr: number, dc: number) => {
    const nextRow = Math.max(0, Math.min(rows - 1, props.focus.row + dr))
    const nextCol = Math.max(0, Math.min(cols - 1, props.focus.col + dc))
    props.setFocus({ row: nextRow, col: nextCol })
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveFocus(-1, 0)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveFocus(1, 0)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      moveFocus(0, -1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      moveFocus(0, 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const cell = props.board[props.focus.row]?.[props.focus.col]
      if (!cell) return
      if (props.flagMode) props.onToggleFlag(cell)
      else props.onReveal(cell)
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault()
      const cell = props.board[props.focus.row]?.[props.focus.col]
      if (cell) props.onToggleFlag(cell)
    } else if (e.key.toLowerCase() === 'c' && props.onChord) {
      e.preventDefault()
      const cell = props.board[props.focus.row]?.[props.focus.col]
      if (cell) props.onChord(cell)
    }
  }

  const gridClass = `${styles.grid} ${props.status === 'won' ? styles.cascade : ''}`

  return (
    <div className={styles.wrap} onKeyDown={onKeyDown} aria-label="Minesweeper board">
      <div className={styles.inner} style={{ '--cols': cols } as React.CSSProperties}>
        <div
          ref={gridRef}
          className={gridClass}
          role="grid"
          aria-rowcount={rows}
          aria-colcount={cols}
        >
          {props.board.map((rowCells, r) =>
            rowCells.map((cell, c) => {
              const safeHit =
                props.hintCells?.safe?.row === r && props.hintCells?.safe?.col === c
              const mineHit =
                props.hintCells?.mine?.row === r && props.hintCells?.mine?.col === c
              const hint = safeHit ? 'safe' : mineHit ? 'mine' : undefined
              return (
                <CellView
                  key={`${r}-${c}`}
                  cell={cell}
                  gameStatus={props.status}
                  isFocused={props.focus.row === r && props.focus.col === c}
                  tabIndex={props.focus.row === r && props.focus.col === c ? 0 : -1}
                  flagMode={props.flagMode}
                  hint={hint}
                  onFocus={() => props.setFocus({ row: r, col: c })}
                  onReveal={() => props.onReveal(cell)}
                  onToggleFlag={() => props.onToggleFlag(cell)}
                  onChord={props.onChord ? () => props.onChord!(cell) : undefined}
                />
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}
