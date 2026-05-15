import type { CSSProperties } from 'react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { playSound } from '../../audio/playSound'
import { submitGame, type SubmitGameInput, type SubmitGameResult } from '../../api/client'
import {
  computeMineProbabilities,
  type CoachHint,
  type CoachPick,
  type CoachReason,
} from '../../game/coach'
import { gameReducer, getElapsedSeconds } from '../../game/game'
import { createInitialState } from '../../game/state'
import { useFlagMode } from '../../game/useFlagMode'
import type { MineVariant, VictoryVariant } from '../../cosmetics/types'
import type { Cell, Difficulty, GameState } from '../../game/types'
import { SPEED_TIME_LIMIT_MS } from '../../game/types'
import { useLanguage } from '../../i18n/languageContext'
import type { TranslationKey } from '../../i18n/translations'
import { Button } from '../../ui/Button/Button'
import { Board } from '../Board/Board'
import { FlagIcon } from '../Cell/icons/FlagIcon'
import { VictoryCelebration } from './VictoryCelebration'
import { ModeToggle } from './ModeToggle'
import styles from './Game.module.css'

type Focus = { row: number; col: number }

type GameProps = {
  difficulty: Difficulty
  seed?: number
  /** Legacy — accent now comes from ThemeProvider via <html data-accent>. Kept for prop-stability. */
  themeStyle?: CSSProperties
  /** When set, on game end the game is persisted via the server and this is called to refresh the caller (e.g. coin balance). Idempotent per completed game. */
  onWinReward?: () => void | Promise<void>
  /** Optional "back to picker" affordance. */
  onChangeDifficulty?: () => void
  /** Replace the default `submitGame` call. Used for special modes like daily. */
  submitOverride?: (input: SubmitGameInput) => Promise<SubmitGameResult>
  /** Hide hints (e.g. competitive modes like daily). */
  hintsDisabled?: boolean
  /** Receive each accepted state transition so wrappers can sync live modes. */
  onStateChange?: (state: GameState) => void
  /** Prevent board interaction while preserving the current board view. */
  locked?: boolean
  /** Force a terminal result from outside the local reducer (e.g. duel opponent finished first). */
  forcedEnd?: { status: 'won' | 'lost'; endedAtMs?: number; score?: number } | null
  /** Hide the built-in win/loss banner so a wrapper can render its own result UI. */
  hideResultBanner?: boolean
  /** Hide restart affordances when the parent mode controls retries. */
  restartDisabled?: boolean
  mineVariant?: MineVariant
  victoryVariant?: VictoryVariant
}

export function Game(props: GameProps) {
  const {
    difficulty,
    seed,
    onWinReward,
    onChangeDifficulty,
    submitOverride,
    hintsDisabled,
    onStateChange,
    locked,
    forcedEnd,
    hideResultBanner,
    restartDisabled,
    mineVariant = 'classic',
    victoryVariant = 'confetti',
  } = props
  const { t } = useLanguage()
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createInitialState(difficulty, seed),
  )
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [focus, setFocus] = useState<Focus>({ row: 0, col: 0 })
  const [submittedGameId, setSubmittedGameId] = useState<string | null>(null)
  const [grantedCoins, setGrantedCoins] = useState<number>(0)
  const lastSubmittedEndMs = useRef<number | null>(null)
  const { flagMode, setFlagMode } = useFlagMode()
  const HINTS_PER_GAME = 3
  const [hintsLeft, setHintsLeft] = useState(HINTS_PER_GAME)
  const [hintCells, setHintCells] = useState<CoachHint | null>(null)
  const [hintExplanations, setHintExplanations] = useState<string[]>([])
  const hintTimerRef = useRef<number | null>(null)
  const appliedForcedEndKey = useRef<string | null>(null)

  useEffect(() => {
    onStateChange?.(state)
  }, [onStateChange, state])

  useEffect(() => {
    if (!forcedEnd) return
    if (state.status === 'won' || state.status === 'lost') return
    const key = `${forcedEnd.status}:${forcedEnd.endedAtMs ?? 'auto'}:${forcedEnd.score ?? 'keep'}`
    if (appliedForcedEndKey.current === key) return
    appliedForcedEndKey.current = key
    dispatch({
      type: 'forceEnd',
      status: forcedEnd.status,
      nowMs: forcedEnd.endedAtMs ?? Date.now(),
      score: forcedEnd.score,
    })
  }, [forcedEnd, state.status])

  useEffect(() => {
    if (!state.startedAtMs || state.endedAtMs) return
    const id = window.setInterval(() => setNowMs(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [state.startedAtMs, state.endedAtMs])

  // Speed mode: force end at 2 minutes.
  useEffect(() => {
    if (state.difficulty.slug !== 'speed') return
    if (state.status !== 'playing') return
    if (!state.startedAtMs) return
    const elapsed = nowMs - state.startedAtMs
    if (elapsed >= SPEED_TIME_LIMIT_MS) {
      dispatch({ type: 'timeUp', nowMs: Date.now() })
    }
  }, [nowMs, state.startedAtMs, state.status, state.difficulty.slug])

  useEffect(() => {
    if (state.status !== 'won' && state.status !== 'lost') return
    if (!state.endedAtMs || !state.startedAtMs) return
    if (lastSubmittedEndMs.current === state.endedAtMs) return
    playSound(state.status === 'won' ? 'win' : 'loss')
    if (!onWinReward) {
      lastSubmittedEndMs.current = state.endedAtMs
      return // guest mode — don't persist
    }
    lastSubmittedEndMs.current = state.endedAtMs
    const submission = {
      status: state.status,
      durationMs: state.endedAtMs - state.startedAtMs,
      score: state.score,
      moves: state.moves,
      seed: state.seed,
      rows: state.difficulty.rows,
      cols: state.difficulty.cols,
      mines: state.difficulty.mines,
      presetSlug: state.difficulty.slug,
      startedAt: new Date(state.startedAtMs).toISOString(),
      endedAt: new Date(state.endedAtMs).toISOString(),
    }
    void (async () => {
      try {
        const result = submitOverride
          ? await submitOverride(submission)
          : await submitGame(submission)
        if (result.gameId) setSubmittedGameId(result.gameId)
        if (result.grantedCoins) setGrantedCoins(result.grantedCoins)
      } catch {
        /* offline / rate-limited — ignore */
      }
      await onWinReward()
    })()
  }, [
    state.status,
    state.endedAtMs,
    state.startedAtMs,
    state.score,
    state.moves,
    state.seed,
    state.difficulty.rows,
    state.difficulty.cols,
    state.difficulty.mines,
    state.difficulty.slug,
    onWinReward,
    submitOverride,
  ])

  const elapsedSeconds = useMemo(() => getElapsedSeconds(state, nowMs), [state, nowMs])
  const minesRemaining = state.difficulty.mines - state.flagsPlaced
  const isSpeedMode = state.difficulty.slug === 'speed'
  const speedRemaining = isSpeedMode
    ? Math.max(0, SPEED_TIME_LIMIT_MS / 1000 - elapsedSeconds)
    : 0
  const speedDanger = isSpeedMode && speedRemaining > 0 && speedRemaining <= 10

  const onReveal = (cell: Cell) => {
    if (locked) return
    if (cell.state === 'covered') playSound('reveal')
    dispatch({ type: 'reveal', row: cell.row, col: cell.col, nowMs: Date.now() })
  }

  const onToggleFlag = (cell: Cell) => {
    if (locked) return
    if (cell.state !== 'revealed') playSound('flag')
    dispatch({ type: 'toggleFlag', row: cell.row, col: cell.col, nowMs: Date.now() })
  }

  const onChord = (cell: Cell) => {
    if (locked) return
    playSound('click')
    dispatch({ type: 'chord', row: cell.row, col: cell.col, nowMs: Date.now() })
  }

  const onRestart = () => {
    if (restartDisabled) return
    dispatch({ type: 'restart', difficulty })
    setFocus({ row: 0, col: 0 })
    setNowMs(Date.now())
    setSubmittedGameId(null)
    setGrantedCoins(0)
    lastSubmittedEndMs.current = null
    appliedForcedEndKey.current = null
    setHintsLeft(HINTS_PER_GAME)
    setHintCells(null)
    setHintExplanations([])
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = null
  }

  const canUseHint =
    !isSpeedMode && !hintsDisabled && state.status === 'playing' && hintsLeft > 0

  const reasonKeyMap: Record<CoachReason['kind'], TranslationKey> = {
    allMinesFlagged: 'coachReasonAllMinesFlagged',
    allCoveredAreMines: 'coachReasonAllCoveredAreMines',
    lowLocalProb: 'coachReasonLowLocalProb',
    highLocalProb: 'coachReasonHighLocalProb',
  }

  const cellLabel = (row: number, col: number) => `(${row + 1}, ${col + 1})`

  const buildExplanation = (pick: CoachPick, prefixKey: TranslationKey): string => {
    const prefix = t(prefixKey, { cell: cellLabel(pick.row, pick.col) })
    const reason = pick.reason
    const reasonKey = reasonKeyMap[reason.kind]
    const needed =
      reason.srcNumber !== undefined && reason.flagsAdj !== undefined
        ? Math.max(0, reason.srcNumber - reason.flagsAdj)
        : 0
    return `${prefix}. ${t(reasonKey, {
      src: cellLabel(reason.srcRow ?? 0, reason.srcCol ?? 0),
      srcNumber: reason.srcNumber ?? 0,
      flagsAdj: reason.flagsAdj ?? 0,
      coveredAdj: reason.coveredAdj ?? 0,
      needed,
    })}`
  }

  const onHint = () => {
    if (!canUseHint) return
    const hint = computeMineProbabilities(state.board)
    if (!hint.safe && !hint.mine) return
    setHintCells(hint)
    const lines: string[] = []
    if (hint.safe) lines.push(buildExplanation(hint.safe, 'coachSafePrefix'))
    if (hint.mine) lines.push(buildExplanation(hint.mine, 'coachMinePrefix'))
    setHintExplanations(lines)
    setHintsLeft((n) => n - 1)
    playSound('click')
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = window.setTimeout(() => {
      setHintCells(null)
      setHintExplanations([])
      hintTimerRef.current = null
    }, 8000)
  }

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    }
  }, [])

  const finished = state.status === 'won' || state.status === 'lost'
  const difficultyLabel = difficulty.slug
    ? t(difficulty.slug === 'beginner'
        ? 'beginner'
        : difficulty.slug === 'intermediate'
          ? 'intermediate'
          : difficulty.slug === 'expert'
            ? 'expert'
            : difficulty.slug === 'speed'
              ? 'speed'
              : 'custom')
    : t('custom')
  const timerSeconds = isSpeedMode ? Math.ceil(speedRemaining) : Math.floor(elapsedSeconds)
  const timerDisplay = timerSeconds.toString().padStart(3, '0')
  const minesDisplay = minesRemaining.toString().padStart(3, '0')
  const timeLabel = isSpeedMode ? t('timeLeft') : t('time')

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.difficultyPill}
          onClick={onChangeDifficulty}
          disabled={!onChangeDifficulty}
          title={onChangeDifficulty ? t('changeDifficulty') : difficultyLabel}
        >
          <span className={styles.difficultyLabel}>{difficultyLabel}</span>
          {onChangeDifficulty && (
            <svg
              className={styles.chevron}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className={styles.counters}>
          <div className={styles.counter} aria-label={`${t('minesLeft')}: ${minesRemaining}`}>
            <FlagIcon className={styles.counterIcon} />
            <span className={styles.counterValue}>{minesDisplay}</span>
          </div>
          <div
            className={`${styles.counter} ${speedDanger ? styles.counterDanger : ''}`}
            aria-label={`${timeLabel}: ${timerSeconds}`}
          >
            <svg
              className={styles.counterIcon}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 13V8.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 13l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 3h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className={styles.counterValue}>{timerDisplay}</span>
          </div>
        </div>

        <div className={styles.controls}>
          <ModeToggle flagMode={flagMode} onChange={setFlagMode} />
          {!isSpeedMode && !hintsDisabled && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onHint}
              disabled={!canUseHint}
              title={t('hintTitle')}
              aria-label={`${t('hint')} (${hintsLeft})`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.iconBtnSvg}>
                <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c1 1 1.5 2 1.5 3.5h5c0-1.5.5-2.5 1.5-3.5A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className={styles.iconBtnBadge}>{hintsLeft}</span>
            </button>
          )}
          {!restartDisabled && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onRestart}
              title={t('restart')}
              aria-label={t('restart')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.iconBtnSvg}>
                <path d="M20 12a8 8 0 1 1-2.3-5.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {!hideResultBanner && finished && (
          <div
            className={`${styles.resultBanner} ${state.status === 'won' ? styles.resultWin : styles.resultLoss}`}
            role="status"
          >
            <div>
              <strong>
                {state.status === 'won'
                  ? t('youWonBang')
                  : isSpeedMode && speedRemaining === 0
                    ? t('timesUp')
                    : t('gameOverPeriod')}
              </strong>
              {isSpeedMode && state.status !== 'won' && state.score > 0 && (
                <span className={styles.resultExtra}> · {state.score} {t('pts')}</span>
              )}
              {grantedCoins > 0 && <span className={styles.resultExtra}> +{grantedCoins} 🪙</span>}
            </div>
            <div className={styles.resultActions}>
              <Button variant="primary" onClick={onRestart}>
                {t('playAgain')}
              </Button>
              {submittedGameId && (
                <Link to={`/history/${submittedGameId}`}>
                  <Button variant="secondary">{t('viewAnalysis')}</Button>
                </Link>
              )}
            </div>
          </div>
        )}

        <Board
          key={state.startedAtMs ?? 'fresh'}
          board={state.board}
          status={state.status}
          focus={focus}
          setFocus={setFocus}
          flagMode={flagMode}
          mineVariant={mineVariant}
          hintCells={hintCells}
          onReveal={onReveal}
          onToggleFlag={onToggleFlag}
          onChord={onChord}
        />

        {state.status === 'won' && <VictoryCelebration variant={victoryVariant} />}

        {hintExplanations.length > 0 && (
          <div className={styles.coachStrip} role="status">
            <strong className={styles.coachLabel}>💡 {t('coachLabel')}</strong>
            <ul className={styles.coachList}>
              {hintExplanations.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <details className={styles.shortcutsDetails}>
          <summary className={styles.shortcutsSummary}>? {t('shortcuts')}</summary>
          <div className={styles.hint}>
            {t('clickTo')} {flagMode ? t('plantFlag') : t('reveal')} •{' '}
            {t('rightClickFlags')} •{' '}
            <span className={styles.kbd}>T</span> {t('togglesMode')} •{' '}
            <span className={styles.kbd}>F</span> {t('flagsFocusedCell')} •{' '}
            <span className={styles.kbd}>C</span> {t('chords')} •{' '}
            {t('keyboardPlay', { enter: 'Enter' })}
          </div>
        </details>
      </main>
    </div>
  )
}
