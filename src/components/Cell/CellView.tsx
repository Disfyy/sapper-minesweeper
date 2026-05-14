import { useRef } from 'react'
import type { Cell, GameStatus } from '../../game/types'
import { useLanguage } from '../../i18n/languageContext'
import type { TranslationKey } from '../../i18n/translations'
import styles from './CellView.module.css'

function numberClass(n: number): string {
  if (n === 1) return styles.n1
  if (n === 2) return styles.n2
  if (n === 3) return styles.n3
  if (n === 4) return styles.n4
  if (n === 5) return styles.n5
  if (n === 6) return styles.n6
  if (n === 7) return styles.n7
  if (n === 8) return styles.n8
  return ''
}

function joinCellLabel(base: string, detail: string): string {
  return `${base}, ${detail}`
}

function ariaLabelFor(
  cell: Cell,
  gameStatus: GameStatus,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const base = t('cellPosition', { row: cell.row + 1, col: cell.col + 1 })
  if (cell.state === 'flagged') return joinCellLabel(base, t('cellFlagged'))

  const revealOnEnd = gameStatus === 'lost' || gameStatus === 'won'
  if (cell.state === 'covered' && revealOnEnd && cell.isMine) return joinCellLabel(base, t('cellMine'))
  if (cell.state === 'covered') return joinCellLabel(base, t('cellCovered'))

  if (cell.isMine) return joinCellLabel(base, t('cellMine'))
  if (cell.adjacentMines === 0) return joinCellLabel(base, t('cellEmpty'))
  return joinCellLabel(base, t('cellAdjacentMines', { count: cell.adjacentMines }))
}

export function CellView(props: {
  cell: Cell
  gameStatus: GameStatus
  isFocused: boolean
  tabIndex: number
  flagMode?: boolean
  hint?: 'safe' | 'mine'
  onFocus: () => void
  onReveal: () => void
  onToggleFlag: () => void
  onChord?: () => void
}) {
  const { t } = useLanguage()
  const { cell, flagMode, hint } = props
  const revealOnEnd = props.gameStatus === 'lost' || props.gameStatus === 'won'
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)

  const showsMine = (cell.state === 'revealed' && cell.isMine) || (revealOnEnd && cell.isMine)
  const showsWrongFlag = revealOnEnd && cell.state === 'flagged' && !cell.isMine

  let content: React.ReactNode = null
  if (showsMine) content = '💣'
  else if (showsWrongFlag) content = '✖'
  else if (cell.state === 'flagged') content = '🚩'
  else if (cell.state === 'revealed' && !cell.isMine && cell.adjacentMines > 0)
    content = cell.adjacentMines

  const classNames = [
    styles.cell,
    cell.state === 'revealed' ? styles.revealed : styles.covered,
    showsMine && cell.exploded ? styles.exploded : '',
    content && typeof content === 'number' ? numberClass(content) : '',
    props.isFocused ? styles.focused : '',
    flagMode && cell.state === 'covered' && !showsMine ? styles.flagModeHint : '',
    hint === 'safe' ? styles.hintSafe : '',
    hint === 'mine' ? styles.hintMine : '',
  ]
    .filter(Boolean)
    .join(' ')

  const onContextMenu: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault()
    props.onToggleFlag()
  }

  const onClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (e.button !== 0) return
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    if (flagMode) {
      props.onToggleFlag()
    } else {
      props.onReveal()
    }
  }

  const onDoubleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (!props.onChord) return
    e.preventDefault()
    props.onChord()
  }

  // Long press (mobile) — always flags, regardless of mode (power-user shortcut).
  const onPointerDown: React.PointerEventHandler<HTMLButtonElement> = (e) => {
    if (e.pointerType === 'mouse') return
    longPressTriggeredRef.current = false
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      props.onToggleFlag()
      longPressTriggeredRef.current = true
      longPressTimerRef.current = null
    }, 450)
  }
  const onPointerUpCancel: React.PointerEventHandler<HTMLButtonElement> = () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  return (
    <button
      type="button"
      className={classNames}
      data-row={cell.row}
      data-col={cell.col}
      role="gridcell"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onFocus={props.onFocus}
      tabIndex={props.tabIndex}
      aria-label={ariaLabelFor(cell, props.gameStatus, t)}
      style={{ '--r': cell.row, '--c': cell.col } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUpCancel}
      onPointerCancel={onPointerUpCancel}
      onPointerLeave={onPointerUpCancel}
    >
      {content}
    </button>
  )
}
