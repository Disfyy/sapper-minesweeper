import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  equipTheme,
  getMarketThemes,
  getMyStats,
  type MarketTheme,
  type UserStats,
} from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/languageContext'
import { Button } from '../ui/Button/Button'
import { Card } from '../ui/Card/Card'
import styles from './Pages.module.css'

function formatBest(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60_000)
  const rem = (ms - min * 60_000) / 1000
  return `${min}m ${rem.toFixed(0)}s`
}

export function ProfilePage() {
  const { user, loading: authLoading, refresh } = useAuth()
  const { t } = useLanguage()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [themes, setThemes] = useState<MarketTheme[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    void Promise.all([getMyStats(), getMarketThemes()])
      .then(([s, market]) => {
        setStats(s)
        setThemes(market.themes)
        setErr(null)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : t('failedLoadProfile')))
  }, [user, t])

  if (authLoading) return <div className={styles.centered}>{t('loading')}</div>
  if (!user) {
    return (
      <div className={styles.formPage}>
        <h1 className={styles.h1}>{t('profile')}</h1>
        <p className={styles.muted}>
          <Link to="/login">{t('logIn')}</Link> {t('guestBannerOr')}{' '}
          <Link to="/register">{t('register')}</Link> {t('profileLoginPrompt')}
        </p>
      </div>
    )
  }

  async function equip(theme: MarketTheme) {
    setBusyId(theme.id)
    setErr(null)
    try {
      await equipTheme(theme.id)
      await refresh()
      const next = await getMarketThemes()
      setThemes(next.themes)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('equipFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const winRate = stats && stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0
  const ownedThemes = themes.filter((theme) => theme.owned)

  return (
    <div className={styles.profile}>
      <header className={styles.profileHead}>
        <div>
          <h1 className={styles.h1}>{user.displayName || user.email}</h1>
          <p className={styles.muted}>{user.email}</p>
        </div>
        <div className={styles.coinsPill}>{user.coins} 🪙</div>
      </header>

      {err && <p className={styles.error}>{err}</p>}

      <Card title={t('stats')} subtitle={t('lifetimeRecord')}>
        <div className={styles.statsGrid}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{t('games')}</div>
            <div className={styles.statValue}>{stats?.gamesPlayed ?? 0}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{t('wins')}</div>
            <div className={styles.statValue}>{stats?.wins ?? 0}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{t('winRate')}</div>
            <div className={styles.statValue}>{winRate.toFixed(0)}%</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{t('bestBeginner')}</div>
            <div className={styles.statValue}>{formatBest(stats?.bestTimeBeginnerMs ?? null)}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{t('bestIntermediate')}</div>
            <div className={styles.statValue}>
              {formatBest(stats?.bestTimeIntermediateMs ?? null)}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{t('bestExpert')}</div>
            <div className={styles.statValue}>{formatBest(stats?.bestTimeExpertMs ?? null)}</div>
          </div>
        </div>
      </Card>

      <Card
        title={t('cosmetics')}
        subtitle={t('ownedThemesSubtitle')}
        actions={
          <Link to="/market">
            <Button variant="secondary" size="sm">
              {t('openShop')}
            </Button>
          </Link>
        }
      >
        {ownedThemes.length === 0 ? (
          <p className={styles.muted}>{t('noThemesOwned')}</p>
        ) : (
          <ul className={styles.themeGrid}>
            {ownedThemes.map((theme) => (
              <li key={theme.id} className={styles.themeChip}>
                <div className={styles.themeChipName}>{theme.name}</div>
                {theme.equipped ? (
                  <span className={styles.badge}>{t('equipped')}</span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === theme.id}
                    onClick={() => void equip(theme)}
                  >
                    {t('equip')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
