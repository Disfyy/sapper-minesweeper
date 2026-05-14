import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import heroImg from '../assets/hero.png'
import { useLanguage } from '../i18n/languageContext'
import { Button } from '../ui/Button/Button'
import { Card } from '../ui/Card/Card'
import { Hero } from '../ui/Hero/Hero'
import styles from './Pages.module.css'

export function HomePage() {
  const { user } = useAuth()
  const { t } = useLanguage()

  return (
    <div className={styles.home}>
      <Hero
        image={heroImg}
        imageAlt={t('homeHeroAlt')}
        eyebrow={t('homeEyebrow')}
        title={t('homeTitle')}
        tagline={t('homeTagline')}
        actions={
          <>
            <Link to="/play">
              <Button variant="primary" size="lg">
                {t('playNow')}
              </Button>
            </Link>
            <Link to="/daily">
              <Button variant="secondary" size="lg">
                {t('todaysChallenge')}
              </Button>
            </Link>
            {user ? (
              <Link to="/history">
                <Button variant="ghost" size="lg">
                  {t('yourHistory')}
                </Button>
              </Link>
            ) : (
              <Link to="/register">
                <Button variant="ghost" size="lg">
                  {t('signUp')}
                </Button>
              </Link>
            )}
          </>
        }
        trust={t('homeTrust')}
      />

      <section className={styles.features}>
        <Card title={t('featureStreaksTitle')} subtitle={t('featureStreaksSubtitle')}>
          <p className={styles.featureBody}>
            {t('featureStreaksBody')}
          </p>
        </Card>
        <Card title={t('featureHistoryTitle')} subtitle={t('featureHistorySubtitle')}>
          <p className={styles.featureBody}>
            {t('featureHistoryBody')}
          </p>
        </Card>
        <Card title={t('featureRaceTitle')} subtitle={t('featureRaceSubtitle')}>
          <p className={styles.featureBody}>
            {t('featureRaceBody')}
          </p>
        </Card>
      </section>
    </div>
  )
}
