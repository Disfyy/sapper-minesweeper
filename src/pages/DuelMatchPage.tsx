import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  finishMatch,
  getMatch,
  matchSocketUrl,
  type MatchPlayer,
  type MatchSnapshot,
} from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Game } from '../components/Game/Game'
import type { GameState } from '../game/types'
import { useLanguage } from '../i18n/languageContext'
import type { TranslationKey } from '../i18n/translations'
import { Button } from '../ui/Button/Button'
import { Card } from '../ui/Card/Card'
import styles from './Duel.module.css'
import pageStyles from './Pages.module.css'

function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds - minutes * 60
  return `${minutes}m ${remainder.toFixed(0)}s`
}

function difficultyLabel(
  slug: string | null | undefined,
  t: (key: TranslationKey) => string,
): string {
  if (slug === 'beginner') return t('beginner')
  if (slug === 'intermediate') return t('intermediate')
  if (slug === 'expert') return t('expert')
  if (slug === 'speed') return t('speed')
  return t('custom')
}

function playerStatusLabel(
  status: MatchPlayer['status'],
  t: (key: TranslationKey) => string,
): string {
  if (status === 'ready') return t('ready')
  if (status === 'playing') return t('playing')
  if (status === 'won') return t('win')
  if (status === 'lost') return t('loss')
  if (status === 'draw') return t('duelResultDraw')
  if (status === 'left') return t('duelLeaveMatch')
  return t('duelWaitingForPlayers')
}

export function DuelMatchPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [match, setMatch] = useState<MatchSnapshot | null>(null)
  const [localState, setLocalState] = useState<GameState | null>(null)
  const [submittedGameId, setSubmittedGameId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionLost, setConnectionLost] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const submitKeyRef = useRef<string | null>(null)
  const progressKeyRef = useRef<string | null>(null)
  const closingRef = useRef(false)

  useEffect(() => {
    if (!matchId || !user) return
    let cancelled = false
    void (async () => {
      try {
        const next = await getMatch(matchId)
        if (cancelled) return
        setMatch(next)
        const playerGameId =
          next.players.find((player) => player.userId === next.viewerUserId)?.gameId ?? null
        setSubmittedGameId(playerGameId)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : t('duelMatchNotFound'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [matchId, t, user])

  useEffect(() => {
    if (!matchId || !user) return
    closingRef.current = false
    const socket = new WebSocket(matchSocketUrl(matchId))
    socketRef.current = socket

    socket.addEventListener('open', () => {
      setConnectionLost(false)
    })
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string
          payload: MatchSnapshot | { message?: string }
        }
        if (data.type === 'match:error') {
          setError((data.payload as { message?: string }).message ?? t('duelConnectFailed'))
          return
        }
        setMatch(data.payload as MatchSnapshot)
        const playerGameId =
          (data.payload as MatchSnapshot).players.find(
            (player) => player.userId === (data.payload as MatchSnapshot).viewerUserId,
          )?.gameId ?? null
        if (playerGameId) setSubmittedGameId(playerGameId)
      } catch {
        setError(t('duelConnectFailed'))
      }
    })
    socket.addEventListener('close', () => {
      if (!closingRef.current) setConnectionLost(true)
    })
    socket.addEventListener('error', () => {
      setConnectionLost(true)
    })

    return () => {
      closingRef.current = true
      socket.close()
      socketRef.current = null
    }
  }, [matchId, t, user])

  const localPlayer = useMemo(
    () => match?.players.find((player) => player.userId === match.viewerUserId) ?? null,
    [match],
  )
  const opponent = useMemo(
    () => match?.players.find((player) => player.userId !== match.viewerUserId) ?? null,
    [match],
  )

  const difficulty = useMemo(
    () =>
      match
        ? {
            rows: match.difficulty.rows,
            cols: match.difficulty.cols,
            mines: match.difficulty.mines,
            slug: match.difficulty.presetSlug ?? undefined,
          }
        : null,
    [match],
  )

  const forcedEnd = useMemo(() => {
    if (!match || !localPlayer) return null
    if (match.status !== 'finished') return null
    if (localPlayer.status !== 'won' && localPlayer.status !== 'lost') return null
    if (localState && (localState.status === 'won' || localState.status === 'lost')) return null
    return {
      status: localPlayer.status,
      endedAtMs: match.endedAt ? Date.parse(match.endedAt) : Date.now(),
      score: localPlayer.score,
    }
  }, [localPlayer, localState, match])

  useEffect(() => {
    if (!localState || !localPlayer) return
    if (!match || match.status !== 'playing') return
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    const durationMs =
      localState.startedAtMs && localState.endedAtMs
        ? localState.endedAtMs - localState.startedAtMs
        : localState.startedAtMs
          ? Date.now() - localState.startedAtMs
          : 0
    const key = [
      localState.status,
      localState.score,
      durationMs,
      localState.revealedSafeCount,
      localState.flagsPlaced,
      localState.moves.length,
    ].join(':')
    if (progressKeyRef.current === key) return
    progressKeyRef.current = key

    socket.send(
      JSON.stringify({
        type: 'match:progress',
        status: localState.status,
        score: localState.score,
        durationMs,
        revealedSafeCount: localState.revealedSafeCount,
        flagsPlaced: localState.flagsPlaced,
      }),
    )
  }, [localPlayer, localState, match])

  useEffect(() => {
    if (!match || !localPlayer || !localState || !difficulty) return
    if (localPlayer.status === 'left' || localPlayer.gameId) return
    if (localState.status !== 'won' && localState.status !== 'lost') return
    if (!localState.endedAtMs) return

    const submitKey = `${localState.status}:${localState.endedAtMs}`
    if (submitKeyRef.current === submitKey) return
    submitKeyRef.current = submitKey

    const startedAtMs = localState.startedAtMs ?? localState.endedAtMs
    void (async () => {
      try {
        const result = await finishMatch(match.id, {
          status: localState.status === 'won' ? 'won' : 'lost',
          durationMs: Math.max(0, localState.endedAtMs! - startedAtMs),
          score: localState.score,
          moves: localState.moves,
          seed: match.seed,
          rows: difficulty.rows,
          cols: difficulty.cols,
          mines: difficulty.mines,
          presetSlug: difficulty.slug,
          startedAt: new Date(startedAtMs).toISOString(),
          endedAt: new Date(localState.endedAtMs!).toISOString(),
          revealedSafeCount: localState.revealedSafeCount,
          flagsPlaced: localState.flagsPlaced,
        })
        setSubmittedGameId(result.gameId)
        setMatch(result.match)
      } catch (err) {
        submitKeyRef.current = null
        setError(err instanceof Error ? err.message : t('duelConnectFailed'))
      }
    })()
  }, [difficulty, localPlayer, localState, match, t])

  const onReadyToggle = () => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !localPlayer) return
    socket.send(
      JSON.stringify({
        type: 'match:ready',
        ready: localPlayer.status !== 'ready',
      }),
    )
  }

  const onLeave = () => {
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'match:leave' }))
    }
    navigate('/duel')
  }

  const onCopyCode = async () => {
    if (!match) return
    try {
      await navigator.clipboard.writeText(match.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setError(t('duelConnectFailed'))
    }
  }

  if (loading) return <div className={pageStyles.centered}>{t('loading')}</div>
  if (!user) {
    return (
      <div className={pageStyles.formPage}>
        <h1 className={pageStyles.h1}>{t('duelTitle')}</h1>
        <p className={pageStyles.muted}>
          <Link to="/login">{t('logIn')}</Link> {t('duelLoginPrompt')}
        </p>
      </div>
    )
  }
  if (!matchId || (!match && error)) {
    return (
      <div className={pageStyles.formPage}>
        <h1 className={pageStyles.h1}>{t('duelTitle')}</h1>
        <p className={pageStyles.error}>{error ?? t('duelMatchNotFound')}</p>
        <Link to="/duel">{t('duelBackToLobby')}</Link>
      </div>
    )
  }
  if (!match || !difficulty || !localPlayer) {
    return <div className={pageStyles.centered}>{t('loading')}</div>
  }

  const isSpeed = difficulty.slug === 'speed'
  const resultOpen = match.status === 'finished' || match.status === 'cancelled'
  const resultTitle =
    match.status === 'cancelled'
      ? t('duelResultCancelled')
      : localPlayer.status === 'won'
        ? t('duelResultWin')
        : localPlayer.status === 'lost'
          ? t('duelResultLoss')
          : t('duelResultDraw')
  const resultBody =
    match.status === 'cancelled'
      ? t('duelWaitingForPlayers')
      : isSpeed
        ? t('duelSpeedDecider')
        : localPlayer.status === 'won' && localState?.status !== 'won'
          ? t('duelTheyHitMine')
          : localPlayer.status === 'lost' && localState?.status === 'lost'
            ? t('duelYouHitMine')
            : t('duelFinishedFirst')

  return (
    <div className={styles.matchPage}>
      <header className={styles.matchHeader}>
        <div>
          <h1 className={styles.title}>{difficultyLabel(difficulty.slug, t)}</h1>
          <p className={styles.lead}>
            {difficulty.rows}×{difficulty.cols} · {difficulty.mines} {t('mines')} · {t('seed')} {match.seed}
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.codePill}>
            <span>{t('duelRoomCode')}</span>
            <strong>{match.code}</strong>
          </div>
          <Button variant="secondary" onClick={() => void onCopyCode()}>
            {copied ? t('duelCopied') : t('duelCopyCode')}
          </Button>
          <Button variant="ghost" onClick={onLeave}>
            {t('duelLeaveMatch')}
          </Button>
        </div>
      </header>

      {error && <p className={pageStyles.error}>{error}</p>}
      {connectionLost && <p className={styles.connection}>{t('duelConnectionLost')}</p>}

      {match.status !== 'playing' && match.status !== 'finished' && match.status !== 'cancelled' ? (
        <section className={styles.waitingGrid}>
          <Card title={t('duelShareCode')} subtitle={match.code}>
            <p className={styles.waitingText}>
              {opponent ? t('duelWaitingForReady') : t('duelWaitingForPlayers')}
            </p>
            <div className={styles.waitingActions}>
              <Button variant="primary" onClick={onReadyToggle}>
                {localPlayer.status === 'ready' ? t('duelCancelReady') : t('duelReadyUp')}
              </Button>
            </div>
          </Card>

          <Card title={t('player')} subtitle={t('status')}>
            <div className={styles.playerList}>
              {[localPlayer, opponent].filter(Boolean).map((player) => (
                <div key={player!.userId} className={styles.playerRow}>
                  <div>
                    <div className={styles.playerName}>
                      {player!.userId === match.viewerUserId ? t('duelYou') : player!.displayName ?? player!.email}
                    </div>
                    <div className={styles.playerMeta}>
                      {player!.side === 'host' ? t('duelHost') : t('duelGuest')}
                    </div>
                  </div>
                  <strong>{playerStatusLabel(player!.status, t)}</strong>
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : (
        <section className={styles.liveGrid}>
          <div className={styles.boardPanel}>
            <div className={styles.sectionLabel}>{t('duelYourBoard')}</div>
            <Game
              difficulty={difficulty}
              seed={match.seed}
              hintsDisabled
              restartDisabled
              hideResultBanner
              locked={match.status !== 'playing'}
              forcedEnd={forcedEnd}
              onStateChange={setLocalState}
              mineVariant={user.equippedMineVariant ?? 'classic'}
              victoryVariant={user.equippedVictoryVariant ?? 'confetti'}
            />
          </div>

          <aside className={styles.sidebar}>
            <Card title={t('duelOpponentProgress')} subtitle={opponent?.displayName ?? opponent?.email ?? t('duelWaitingForPlayers')}>
              {opponent ? (
                <div className={styles.progressGrid}>
                  <div className={styles.progressStat}>
                    <span>{t('status')}</span>
                    <strong>{playerStatusLabel(opponent.status, t)}</strong>
                  </div>
                  <div className={styles.progressStat}>
                    <span>{t('duelRevealed')}</span>
                    <strong>{opponent.revealedSafeCount}</strong>
                  </div>
                  <div className={styles.progressStat}>
                    <span>{t('duelFlags')}</span>
                    <strong>{opponent.flagsPlaced}</strong>
                  </div>
                  <div className={styles.progressStat}>
                    <span>{t('score')}</span>
                    <strong>{opponent.score}</strong>
                  </div>
                  <div className={styles.progressStat}>
                    <span>{t('time')}</span>
                    <strong>{formatDuration(opponent.durationMs)}</strong>
                  </div>
                </div>
              ) : (
                <p className={styles.waitingText}>{t('duelWaitingForPlayers')}</p>
              )}
            </Card>

            <Card title={t('duelYou')} subtitle={localPlayer.displayName ?? localPlayer.email}>
              <div className={styles.progressGrid}>
                <div className={styles.progressStat}>
                  <span>{t('status')}</span>
                  <strong>{playerStatusLabel(localPlayer.status, t)}</strong>
                </div>
                <div className={styles.progressStat}>
                  <span>{t('duelRevealed')}</span>
                  <strong>{localPlayer.revealedSafeCount}</strong>
                </div>
                <div className={styles.progressStat}>
                  <span>{t('duelFlags')}</span>
                  <strong>{localPlayer.flagsPlaced}</strong>
                </div>
                <div className={styles.progressStat}>
                  <span>{t('score')}</span>
                  <strong>{localPlayer.score}</strong>
                </div>
                <div className={styles.progressStat}>
                  <span>{t('time')}</span>
                  <strong>{formatDuration(localPlayer.durationMs)}</strong>
                </div>
              </div>
            </Card>
          </aside>
        </section>
      )}

      {resultOpen && (
        <div className={styles.resultOverlay}>
          <div className={styles.resultModal}>
            <h2>{resultTitle}</h2>
            <p>{resultBody}</p>
            <div className={styles.resultMeta}>
              <span>{t('score')}: {localPlayer.score}</span>
              <span>{t('time')}: {formatDuration(localPlayer.durationMs)}</span>
            </div>
            <div className={styles.resultActions}>
              <Link to="/duel">
                <Button variant="primary">{t('duelBackToLobby')}</Button>
              </Link>
              {submittedGameId && (
                <Link to={`/history/${submittedGameId}`}>
                  <Button variant="secondary">{t('viewAnalysis')}</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
