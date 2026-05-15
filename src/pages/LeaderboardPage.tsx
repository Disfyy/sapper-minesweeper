import { useEffect, useMemo, useState } from 'react'
import {
  fetchLeaderboard,
  fetchLeaderboardCities,
  type LeaderboardCity,
  type LeaderboardDifficulty,
  type LeaderboardEntry,
} from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/languageContext'
import type { TranslationKey } from '../i18n/translations'
import { Button } from '../ui/Button/Button'
import styles from './Leaderboard.module.css'

const DIFFICULTIES: { slug: LeaderboardDifficulty; labelKey: TranslationKey }[] = [
  { slug: 'beginner', labelKey: 'beginner' },
  { slug: 'intermediate', labelKey: 'intermediate' },
  { slug: 'expert', labelKey: 'expert' },
  { slug: 'speed', labelKey: 'speed' },
]

function formatTime(ms: number | null): string {
  if (ms === null) return '—'
  const totalSeconds = ms / 1000
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

type ScopeMode = 'global' | 'city'

export function LeaderboardPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [difficulty, setDifficulty] = useState<LeaderboardDifficulty>('beginner')
  const [items, setItems] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<ScopeMode>('global')
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [cities, setCities] = useState<LeaderboardCity[]>([])

  useEffect(() => {
    let alive = true
    void fetchLeaderboardCities()
      .then((list) => {
        if (alive) setCities(list)
      })
      .catch(() => {
        if (alive) setCities([])
      })
    return () => {
      alive = false
    }
  }, [])

  // Pick a default city: the user's own city if they have one, otherwise the most-played city.
  useEffect(() => {
    if (selectedCity) return
    if (user?.city) {
      setSelectedCity(user.city)
      return
    }
    if (cities[0]) setSelectedCity(cities[0].city)
  }, [user?.city, cities, selectedCity])

  const cityFilter = scope === 'city' ? selectedCity || null : null

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)

    void fetchLeaderboard(difficulty, cityFilter)
      .then((entries) => {
        if (!alive) return
        setItems(entries)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setItems([])
        setError(e instanceof Error ? e.message : t('leaderboardLoadFailed'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [difficulty, cityFilter, t])

  const activeLabel = useMemo(
    () => t(DIFFICULTIES.find((item) => item.slug === difficulty)?.labelKey ?? 'beginner'),
    [difficulty, t],
  )

  const selectDifficulty = (next: LeaderboardDifficulty) => {
    if (next === difficulty) return
    setDifficulty(next)
  }

  const isSpeed = difficulty === 'speed'
  const scopeTitle =
    scope === 'city' && selectedCity ? selectedCity : t('globalLeaderboard')

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{scopeTitle}</p>
          <h1 className={styles.title}>
            {activeLabel} {isSpeed ? t('topScores') : t('bestTimes')}
          </h1>
        </div>
        <div className={styles.segmented} aria-label={t('leaderboardDifficulty')}>
          {DIFFICULTIES.map((item) => (
            <Button
              key={item.slug}
              type="button"
              size="sm"
              variant={difficulty === item.slug ? 'primary' : 'secondary'}
              onClick={() => selectDifficulty(item.slug)}
              aria-pressed={difficulty === item.slug}
            >
              {t(item.labelKey)}
            </Button>
          ))}
        </div>
      </header>

      <div className={styles.segmented} aria-label={t('scopeLabel')} style={{ marginBottom: '1rem' }}>
        <Button
          type="button"
          size="sm"
          variant={scope === 'global' ? 'primary' : 'secondary'}
          onClick={() => setScope('global')}
          aria-pressed={scope === 'global'}
        >
          {t('scopeGlobal')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={scope === 'city' ? 'primary' : 'secondary'}
          onClick={() => setScope('city')}
          aria-pressed={scope === 'city'}
          disabled={cities.length === 0 && !user?.city}
        >
          {t('scopeMyCity')}
        </Button>
        {scope === 'city' && cities.length > 0 && (
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            aria-label={t('pickCity')}
            style={{
              marginLeft: '0.5rem',
              padding: '0.4rem 0.6rem',
              borderRadius: '8px',
              border: '1px solid var(--btn-border)',
              background: 'var(--surface-1)',
              color: 'var(--text)',
            }}
          >
            {cities.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city} ({c.playerCount})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={styles.table} aria-live="polite">
        <div className={styles.tableHead}>
          <span>{t('rank')}</span>
          <span>{t('player')}</span>
          <span className={styles.num}>{isSpeed ? t('bestScore') : t('bestTime')}</span>
          <span className={styles.num}>{isSpeed ? t('games') : t('wins')}</span>
        </div>

        {loading && <div className={styles.state}>{t('leaderboardLoading')}</div>}
        {!loading && error && <div className={styles.state}>{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className={styles.state}>
            {isSpeed ? t('noSpeedSprints') : t('noWinningGames')}
          </div>
        )}

        {!loading &&
          !error &&
          items.map((entry) => (
            <div
              className={styles.row}
              key={`${entry.rank}-${entry.displayName || entry.username || 'anonymous'}`}
            >
              <span className={styles.rank}>#{entry.rank}</span>
              <span>
                <strong>{entry.displayName || entry.username || t('anonymousSapper')}</strong>
                {entry.username && entry.displayName && (
                  <span className={styles.handle}>@{entry.username}</span>
                )}
                {entry.city && scope === 'global' && (
                  <span className={styles.handle}> · {entry.city}</span>
                )}
              </span>
              <span className={styles.num}>
                {isSpeed ? (entry.bestScore ?? 0).toLocaleString() : formatTime(entry.bestMs)}
              </span>
              <span className={styles.num}>{entry.gamesPlayed}</span>
            </div>
          ))}
      </div>
    </section>
  )
}
