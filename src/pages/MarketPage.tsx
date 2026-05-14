import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { equipTheme, getMarketThemes, purchaseTheme, type MarketTheme } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/LanguageProvider'
import styles from './Pages.module.css'

export function MarketPage() {
  const { user, loading, refresh } = useAuth()
  const { t } = useLanguage()
  const [themes, setThemes] = useState<MarketTheme[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function load() {
    if (!user) return
    try {
      const { themes: nextThemes } = await getMarketThemes()
      setThemes(nextThemes)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('failedLoadMarket'))
    }
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void getMarketThemes()
      .then(({ themes: nextThemes }) => {
        if (!cancelled) {
          setThemes(nextThemes)
          setErr(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : t('failedLoadMarket'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [user, t])

  if (loading) {
    return <div className={styles.centered}>{t('loading')}</div>
  }

  if (!user) {
    return (
      <div className={styles.formPage}>
        <h1 className={styles.h1}>{t('market')}</h1>
        <p className={styles.muted}>
          <Link to="/login">{t('logIn')}</Link> {t('guestBannerOr')}{' '}
          <Link to="/register">{t('register')}</Link> {t('marketLoginPrompt')}
        </p>
      </div>
    )
  }

  async function buy(t: MarketTheme) {
    setBusyId(t.id)
    setErr(null)
    try {
      await purchaseTheme(t.id)
      await refresh()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('purchaseFailed'))
    } finally {
      setBusyId(null)
    }
  }

  async function equip(t: MarketTheme) {
    setBusyId(t.id)
    setErr(null)
    try {
      await equipTheme(t.id)
      await refresh()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('equipFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className={styles.market}>
      <h1 className={styles.h1}>{t('themeMarket')}</h1>
      <p className={styles.lead}>
        {t('marketLead')} {t('yourBalance')}{' '}
        <strong>{user.coins}</strong> {t('coins')}.
        {!user.isPro && (
          <>
            {' '}
            <Link to="/upgrade" className={styles.upgradeInlineLink}>
              {t('unlockProThemes')}
            </Link>
          </>
        )}
      </p>
      {err && <p className={styles.error}>{err}</p>}
      <ul className={styles.themeList}>
        {themes.map((theme) => {
          const proLocked = theme.proOnly && !user.isPro
          return (
            <li key={theme.id} className={styles.themeCard}>
              <div>
                <div className={styles.themeName}>
                  {theme.name}
                  {theme.proOnly && <span className={styles.proBadge}>{t('pro')}</span>}
                </div>
                <div className={styles.themeSlug}>{theme.slug}</div>
              </div>
              <div className={styles.themeActions}>
                {proLocked ? (
                  <Link to="/upgrade">
                    <button type="button" className={styles.smallBtn}>
                      {t('upgradeToUnlock')}
                    </button>
                  </Link>
                ) : theme.equipped ? (
                  <span className={styles.badge}>{t('equipped')}</span>
                ) : theme.owned ? (
                  <button
                    type="button"
                    className={styles.smallBtn}
                    disabled={busyId === theme.id}
                    onClick={() => void equip(theme)}
                  >
                    {t('equip')}
                  </button>
                ) : (
                  <>
                    <span className={styles.price}>
                      {theme.priceCoins === 0 ? t('free') : `${theme.priceCoins} ${t('coins')}`}
                    </span>
                    <button
                      type="button"
                      className={styles.smallBtn}
                      disabled={busyId === theme.id || user.coins < theme.priceCoins}
                      onClick={() => void buy(theme)}
                    >
                      {t('buy')}
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
