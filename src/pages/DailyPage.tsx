import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getDailyLeaderboard,
  getDailyToday,
  submitDailyAttempt,
  type DailyChallenge,
  type DailyLeaderboardEntry,
  type SubmitGameInput,
  type SubmitGameResult,
} from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Game } from '../components/Game/Game'
import { useLanguage } from '../i18n/LanguageProvider'
import { Button } from '../ui/Button/Button'
import styles from './Pages.module.css'

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

export function DailyPage() {
  const { user, loading: authLoading, refresh } = useAuth()
  const { t } = useLanguage()
  const [daily, setDaily] = useState<DailyChallenge | null>(null)
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finishedAttempt, setFinishedAttempt] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void getDailyToday()
      .then((d) => {
        if (!alive) return
        setDaily(d)
        if (d.alreadyPlayed) setFinishedAttempt(d.attemptGameId)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : t('dailyLoadFailed'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [t])

  const reloadLeaderboard = useCallback(async () => {
    try {
      const lb = await getDailyLeaderboard()
      setLeaderboard(lb.items)
    } catch {
      /* non-fatal */
    }
  }, [])

  useEffect(() => {
    void reloadLeaderboard()
  }, [reloadLeaderboard])

  const submitOverride = useCallback(
    async (input: SubmitGameInput): Promise<SubmitGameResult> => {
      const r = await submitDailyAttempt({
        status: input.status,
        durationMs: input.durationMs,
        score: input.score,
        moves: input.moves,
      })
      if (r.alreadyPlayed) {
        setFinishedAttempt(r.attemptGameId ?? null)
        return { gameId: r.attemptGameId ?? '', coins: 0, grantedCoins: 0 }
      }
      setFinishedAttempt(r.attemptGameId ?? r.gameId ?? null)
      void reloadLeaderboard()
      return { gameId: r.gameId ?? '', coins: 0, grantedCoins: 0 }
    },
    [reloadLeaderboard],
  )

  const onWinReward = useCallback(() => void refresh(), [refresh])

  const difficulty = useMemo(() => {
    if (!daily) return null
    return {
      rows: daily.rows,
      cols: daily.cols,
      mines: daily.mines,
      slug: daily.presetSlug,
    }
  }, [daily])

  if (authLoading || loading) {
    return <div className={styles.centered}>{t('dailyLoading')}</div>
  }

  if (error || !daily) {
    return <div className={styles.centered}>{error ?? t('dailyUnavailable')}</div>
  }

  if (!user) {
    return (
      <section className={styles.dailyShell}>
        <header className={styles.dailyHeader}>
          <p className={styles.dailyEyebrow}>{t('dailyEyebrow', { date: daily.date })}</p>
          <h1 className={styles.dailyTitle}>{t('dailyGuestTitle')}</h1>
          <p className={styles.dailyLead}>
            {t('dailyGuestLead')}
          </p>
        </header>
        <div className={styles.bannerCta}>
          <Link to="/login">
            <Button variant="primary">{t('logIn')}</Button>
          </Link>
          <Link to="/register">
            <Button variant="secondary">{t('createAccount')}</Button>
          </Link>
        </div>
        <DailyLeaderboardTable items={leaderboard} />
      </section>
    )
  }

  return (
    <section className={styles.dailyShell}>
      <header className={styles.dailyHeader}>
        <p className={styles.dailyEyebrow}>{t('dailyEyebrow', { date: daily.date })}</p>
        <h1 className={styles.dailyTitle}>
          {finishedAttempt ? t('dailyPlayedTitle') : t('dailyBoardTitle')}
        </h1>
        <p className={styles.dailyLead}>
          {t('dailyLead', { rows: daily.rows, cols: daily.cols, mines: daily.mines })}
        </p>
      </header>

      {finishedAttempt ? (
        <div className={styles.dailyDone}>
          <p>{t('dailyDone')}</p>
          <Link to={`/history/${finishedAttempt}`}>
            <Button variant="primary">{t('viewAnalysis')}</Button>
          </Link>
        </div>
      ) : (
        difficulty && (
          <Game
            key={`daily-${daily.date}-${daily.seed}`}
            difficulty={difficulty}
            seed={daily.seed}
            onWinReward={onWinReward}
            submitOverride={submitOverride}
            hintsDisabled
          />
        )
      )}

      <DailyLeaderboardTable items={leaderboard} />
    </section>
  )
}

function DailyLeaderboardTable({ items }: { items: DailyLeaderboardEntry[] }) {
  const { t } = useLanguage()
  return (
    <div className={styles.dailyLeaderboard}>
      <h2 className={styles.dailyLbTitle}>{t('dailyLeaderboard')}</h2>
      {items.length === 0 ? (
        <p className={styles.dailyLbEmpty}>{t('dailyEmpty')}</p>
      ) : (
        <ol className={styles.dailyLbList}>
          {items.slice(0, 20).map((entry) => (
            <li key={`${entry.rank}-${entry.displayName || entry.username || 'anonymous'}`} className={styles.dailyLbRow}>
              <span className={styles.dailyLbRank}>#{entry.rank}</span>
              <span className={styles.dailyLbName}>
                {entry.displayName || entry.username || t('anonymousSapper')}
              </span>
              <span className={styles.dailyLbStatus}>
                {entry.status === 'won' ? '✓' : entry.status === 'lost' ? '✗' : '–'}
              </span>
              <span className={styles.dailyLbTime}>
                {entry.status === 'won' ? formatTime(entry.durationMs) : `${entry.score} ${t('pts')}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
