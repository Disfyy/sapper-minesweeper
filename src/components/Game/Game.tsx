import type { CSSProperties } from 'react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { playSound } from '../../audio/playSound'
import { submitGame, type SubmitGameInput, type SubmitGameResult } from '../../api/client'
import { computeMineProbabilities, type CoachHint } from '../../game/coach'
import { gameReducer, getElapsedSeconds } from '../../game/game'
import { createInitialState } from '../../game/state'
import { useFlagMode } from '../../game/useFlagMode'
import type { Cell, Difficulty } from '../../game/types'
import { SPEED_TIME_LIMIT_MS } from '../../game/types'
import { useLanguage } from '../../i18n/LanguageProvider'
import { Button } from '../../ui/Button/Button'
import { Board } from '../Board/Board'
import { Confetti } from './Confetti'
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
}

export function Game(props: GameProps) {
  const { difficulty, seed, onWinReward, onChangeDifficulty, submitOverride, hintsDisabled } = props
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
  const hintTimerRef = useRef<number | null>(null)

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
    if (cell.state === 'covered') playSound('reveal')
    dispatch({ type: 'reveal', row: cell.row, col: cell.col, nowMs: Date.now() })
  }

  const onToggleFlag = (cell: Cell) => {
    if (cell.state !== 'revealed') playSound('flag')
    dispatch({ type: 'toggleFlag', row: cell.row, col: cell.col, nowMs: Date.now() })
  }

  const onChord = (cell: Cell) => {
    playSound('click')
    dispatch({ type: 'chord', row: cell.row, col: cell.col, nowMs: Date.now() })
  }

  const onRestart = () => {
    dispatch({ type: 'restart', difficulty })
    setFocus({ row: 0, col: 0 })
    setNowMs(Date.now())
    setSubmittedGameId(null)
    setGrantedCoins(0)
    lastSubmittedEndMs.current = null
    setHintsLeft(HINTS_PER_GAME)
    setHintCells(null)
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = null
  }

  const canUseHint =
    !isSpeedMode && !hintsDisabled && state.status === 'playing' && hintsLeft > 0

  const onHint = () => {
    if (!canUseHint) return
    const hint = computeMineProbabilities(
      state.board,
      state.difficulty.mines,
      state.flagsPlaced,
    )
    if (!hint.safe && !hint.mine) return
    setHintCells(hint)
    setHintsLeft((n) => n - 1)
    playSound('click')
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = window.setTimeout(() => {
      setHintCells(null)
      hintTimerRef.current = null
    }, 3500)
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
  const statusLabel =
    state.status === 'won'
      ? t('youWon')
      : state.status === 'lost'
        ? t('gameOver')
        : state.status === 'ready'
          ? t('ready')
          : t('playing')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.title}>{difficultyLabel}</div>
          <div className={styles.subtitle}>
            {state.difficulty.rows}×{state.difficulty.cols}, {state.difficulty.mines} {t('mines')}
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{t('status')}</div>
            <div className={styles.statValue}>{statusLabel}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{isSpeedMode ? t('timeLeft') : t('time')}</div>
            <div
              className={`${styles.statValue} ${speedDanger ? styles.statDanger : ''}`}
            >
              {isSpeedMode
                ? `${Math.ceil(speedRemaining).toString().padStart(2, '0')}s`
                : `${elapsedSeconds.toFixed(1)}s`}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{t('score')}</div>
            <div className={styles.statValue}>{state.score}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{t('minesLeft')}</div>
            <div className={styles.statValue}>{minesRemaining}</div>
          </div>
        </div>

        <div className={styles.controls}>
          <ModeToggle flagMode={flagMode} onChange={setFlagMode} />
          {!isSpeedMode && !hintsDisabled && (
            <Button
              variant="secondary"
              onClick={onHint}
              disabled={!canUseHint}
              title={t('hintTitle')}
            >
              💡 {t('hint')} ({hintsLeft})
            </Button>
          )}
          <Button variant="secondary" onClick={onRestart}>
            {t('restart')}
          </Button>
          {onChangeDifficulty && (
            <Button variant="ghost" onClick={onChangeDifficulty}>
              {t('changeDifficulty')}
            </Button>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {finished && (
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
          hintCells={hintCells}
          onReveal={onReveal}
          onToggleFlag={onToggleFlag}
          onChord={onChord}
        />

        {state.status === 'won' && <Confetti />}

        <div className={styles.hint}>
          {t('clickTo')} {flagMode ? t('plantFlag') : t('reveal')} •{' '}
          {t('rightClickFlags')} •{' '}
          <span className={styles.kbd}>T</span> {t('togglesMode')} •{' '}
          <span className={styles.kbd}>F</span> {t('flagsFocusedCell')} •{' '}
          <span className={styles.kbd}>C</span> {t('chords')} •{' '}
          {t('keyboardPlay', { enter: 'Enter' })}
        </div>
      </main>
    </div>
  )
}
