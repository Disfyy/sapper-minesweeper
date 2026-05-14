import { useEffect, useMemo, useState } from 'react'
import {
  fetchLeaderboard,
  type LeaderboardDifficulty,
  type LeaderboardEntry,
} from '../api/client'
import { useLanguage } from '../i18n/LanguageProvider'
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

export function LeaderboardPage() {
  const { t } = useLanguage()
  const [difficulty, setDifficulty] = useState<LeaderboardDifficulty>('beginner')
  const [items, setItems] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    void fetchLeaderboard(difficulty)
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
  }, [difficulty, t])

  const activeLabel = useMemo(
    () => t(DIFFICULTIES.find((item) => item.slug === difficulty)?.labelKey ?? 'beginner'),
    [difficulty, t],
  )

  const selectDifficulty = (next: LeaderboardDifficulty) => {
    if (next === difficulty) return
    setDifficulty(next)
    setLoading(true)
    setError(null)
    setItems([])
  }

  const isSpeed = difficulty === 'speed'

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('globalLeaderboard')}</p>
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
