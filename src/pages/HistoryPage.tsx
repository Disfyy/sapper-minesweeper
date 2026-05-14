import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listGames, type GameListItem } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/languageContext'
import { Button } from '../ui/Button/Button'
import { Card } from '../ui/Card/Card'
import { Input } from '../ui/Input/Input'
import styles from './Pages.module.css'

const DIFFICULTIES = ['beginner', 'intermediate', 'expert', 'speed'] as const
const OUTCOMES = ['won', 'lost', 'abandoned'] as const

type Outcome = (typeof OUTCOMES)[number]

function formatDuration(ms: number): string {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const min = Math.floor(s / 60)
  const rem = s - min * 60
  return `${min}m ${rem.toFixed(0)}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function HistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const [items, setItems] = useState<GameListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<{
    difficulty: string
    outcome: Outcome | ''
    from: string
    to: string
  }>({ difficulty: '', outcome: '', from: '', to: '' })

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const res = await listGames({
          difficulty: filters.difficulty || undefined,
          outcome: filters.outcome || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        })
        if (cancelled) return
        setItems(res.items)
        setCursor(res.nextCursor)
        setHasMore(Boolean(res.nextCursor))
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : t('failedLoadHistory'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, filters.difficulty, filters.outcome, filters.from, filters.to, t])

  async function loadMore() {
    if (!cursor) return
    setLoading(true)
    setError(null)
    try {
      const res = await listGames({
        cursor,
        difficulty: filters.difficulty || undefined,
        outcome: filters.outcome || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      })
      setItems((prev) => [...prev, ...res.items])
      setCursor(res.nextCursor)
      setHasMore(Boolean(res.nextCursor))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failedLoadHistory'))
    } finally {
      setLoading(false)
    }
  }

  const outcomeLabel = (s: string): string => {
    if (s === 'won') return t('win')
    if (s === 'lost') return t('loss')
    return t('abandoned')
  }
  const difficultyLabel = (slug: string | null): string => {
    if (slug === 'beginner') return t('beginner')
    if (slug === 'intermediate') return t('intermediate')
    if (slug === 'expert') return t('expert')
    if (slug === 'speed') return t('speed')
    return t('custom')
  }

  if (authLoading) return <div className={styles.centered}>{t('loading')}</div>
  if (!user) {
    return (
      <div className={styles.formPage}>
        <h1 className={styles.h1}>{t('history')}</h1>
        <p className={styles.muted}>
          <Link to="/login">{t('logIn')}</Link> {t('guestBannerOr')}{' '}
          <Link to="/register">{t('register')}</Link> {t('historyLoginPrompt')}
        </p>
      </div>
    )
  }

  return (
    <div className={styles.history}>
      <header className={styles.historyHead}>
        <h1 className={styles.h1}>{t('gameHistory')}</h1>
      </header>

      <Card>
        <div className={styles.filterGrid}>
          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="diff">
              {t('difficulty')}
            </label>
            <select
              id="diff"
              className={styles.select}
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
            >
              <option value="">{t('any')}</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {difficultyLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="out">
              {t('outcome')}
            </label>
            <select
              id="out"
              className={styles.select}
              value={filters.outcome}
              onChange={(e) => setFilters({ ...filters, outcome: e.target.value as Outcome | '' })}
            >
              <option value="">{t('any')}</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {outcomeLabel(o)}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t('from')}
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <Input
            label={t('to')}
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
      </Card>

      {error && <p className={styles.error}>{error}</p>}

      {items.length === 0 && !loading ? (
        <Card>
          <p className={styles.empty}>
            {t('noGamesYet')} <Link to="/play">{t('playOne')}</Link> {t('noGamesSuffix')}
          </p>
        </Card>
      ) : (
        <div className={styles.historyTable}>
          <div className={styles.historyHeader}>
            <div>{t('date')}</div>
            <div>{t('difficulty')}</div>
            <div>{t('outcome')}</div>
            <div className={styles.numCell}>{t('time')}</div>
            <div className={styles.numCell}>{t('score')}</div>
          </div>
          {items.map((g) => (
            <Link key={g.id} to={`/history/${g.id}`} className={styles.historyRow}>
              <div>{formatDate(g.endedAt)}</div>
              <div>
                {difficultyLabel(g.presetSlug)}
                <span className={styles.dim}>
                  {' '}
                  {g.rows}×{g.cols} · {g.mines}
                </span>
              </div>
              <div className={g.status === 'won' ? styles.win : styles.loss}>{outcomeLabel(g.status)}</div>
              <div className={styles.numCell}>{formatDuration(g.durationMs)}</div>
              <div className={styles.numCell}>{g.score}</div>
            </Link>
          ))}
        </div>
      )}

      {hasMore && (
        <div className={styles.loadMore}>
          <Button variant="secondary" disabled={loading} onClick={() => void loadMore()}>
            {loading ? t('loading') : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
