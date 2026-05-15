import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/languageContext'
import { Button } from '../ui/Button/Button'
import styles from './Home.module.css'

type ModeCard = {
  to: string
  emoji: string
  titleKey: 'modeBeginnerTitle' | 'modeDailyTitle' | 'modeSpeedTitle' | 'modeLeaderboardTitle'
  bodyKey: 'modeBeginnerBody' | 'modeDailyBody' | 'modeSpeedBody' | 'modeLeaderboardBody'
}

const MODE_CARDS: ModeCard[] = [
  { to: '/play', emoji: '♟', titleKey: 'modeBeginnerTitle', bodyKey: 'modeBeginnerBody' },
  { to: '/daily', emoji: '⚡', titleKey: 'modeDailyTitle', bodyKey: 'modeDailyBody' },
  { to: '/play?difficulty=speed', emoji: '⏱', titleKey: 'modeSpeedTitle', bodyKey: 'modeSpeedBody' },
  { to: '/leaderboard', emoji: '🏆', titleKey: 'modeLeaderboardTitle', bodyKey: 'modeLeaderboardBody' },
]

export function HomePage() {
  const { user } = useAuth()
  const { t } = useLanguage()

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t('homeEyebrow')}</p>
        <h1 className={styles.title}>{t('homeTitle')}</h1>
        <p className={styles.tagline}>{t('homeTagline')}</p>

        <div className={styles.heroActions}>
          <Link to="/play?difficulty=beginner" className={styles.primaryLink}>
            <Button variant="primary" size="lg">
              ▶ {t('playNow')}
            </Button>
          </Link>
          <Link to="/play" className={styles.secondaryLink}>
            <Button variant="ghost" size="lg">
              {t('pickDifficulty')}
            </Button>
          </Link>
        </div>
        <p className={styles.trust}>{t('homeTrust')}</p>
      </section>

      <section className={styles.modesSection}>
        <h2 className={styles.h2}>{t('pickAMode')}</h2>
        <div className={styles.modeGrid}>
          {MODE_CARDS.map((card) => (
            <Link key={card.to} to={card.to} className={styles.modeCard}>
              <span className={styles.modeEmoji} aria-hidden="true">
                {card.emoji}
              </span>
              <span className={styles.modeTitle}>{t(card.titleKey)}</span>
              <span className={styles.modeBody}>{t(card.bodyKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      {!user && (
        <section className={styles.signupBanner}>
          <p>
            {t('guestBannerPrefix')} <Link to="/register">{t('signUp')}</Link>{' '}
            {t('guestBannerOr')} <Link to="/login">{t('logIn')}</Link>{' '}
            {t('guestBannerSuffix')}
          </p>
        </section>
      )}
    </div>
  )
}
