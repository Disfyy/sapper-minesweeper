import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { startProCheckout } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/languageContext'
import { Button } from '../ui/Button/Button'
import styles from './Pages.module.css'

export function UpgradePage() {
  const { user, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (authLoading) return <div className={styles.centered}>{t('loading')}</div>

  if (!user) {
    return (
      <div className={styles.formPage}>
        <h1 className={styles.h1}>{t('upgradeToPro')}</h1>
        <p className={styles.muted}>
          <Link to="/login">{t('logIn')}</Link> {t('guestBannerOr')}{' '}
          <Link to="/register">{t('register')}</Link> {t('upgradeLoginPrompt')}
        </p>
      </div>
    )
  }

  if (user.isPro) {
    return (
      <section className={styles.upgrade}>
        <div className={styles.upgradeHero}>
          <span className={styles.upgradeBadge}>{t('proBadge')}</span>
          <h1 className={styles.upgradeTitle}>{t('proMemberTitle')}</h1>
          <p className={styles.upgradeLead}>
            {t('proMemberLead')}
          </p>
        </div>
        <div className={styles.dailyCta}>
          <Link to="/market">
            <Button variant="primary">{t('pickProTheme')}</Button>
          </Link>
          <Link to="/play">
            <Button variant="secondary">{t('play')}</Button>
          </Link>
        </div>
      </section>
    )
  }

  const onUpgrade = async () => {
    setBusy(true)
    setErr(null)
    try {
      const session = await startProCheckout()
      navigate(session.checkoutPath)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('couldNotStartCheckout'))
      setBusy(false)
    }
  }

  return (
    <section className={styles.upgrade}>
      <div className={styles.upgradeHero}>
        <span className={styles.upgradeBadge}>{t('launchOffer')}</span>
        <h1 className={styles.upgradeTitle}>{t('sapperPro')}</h1>
        <p className={styles.upgradeLead}>
          {t('proLead')}
        </p>
      </div>

      <div className={styles.upgradeCard}>
        <div className={styles.upgradePriceRow}>
          <span className={styles.upgradePrice}>$4.99</span>
          <span className={styles.upgradeCadence}>{t('oneTime')}</span>
        </div>

        <ul className={styles.upgradeFeatures}>
          {(['proFeatureThemes', 'proFeatureBadge', 'proFeatureSupport', 'proFeatureCancel'] as const).map((f) => (
            <li className={styles.upgradeFeature} key={f}>
              <span className={styles.upgradeCheck}>✓</span>
              <span>{t(f)}</span>
            </li>
          ))}
        </ul>

        {err && <p className={styles.error}>{err}</p>}

        <Button variant="primary" size="lg" onClick={() => void onUpgrade()} disabled={busy}>
          {busy ? t('startingCheckout') : t('upgradeToPro')}
        </Button>

        <p className={styles.upgradeNote}>
          {t('upgradeNote')}
        </p>
      </div>
    </section>
  )
}
