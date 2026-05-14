import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Game } from '../components/Game/Game'
import { DifficultyPicker } from '../features/play/DifficultyPicker'
import { DIFFICULTY_PRESETS, type Difficulty } from '../game/types'
import { useLanguage } from '../i18n/languageContext'
import { getThemeStyle } from '../themes/presets'
import styles from './Pages.module.css'

export function PlayPage() {
  const { user, loading, refresh } = useAuth()
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const slug = user?.equippedThemeSlug ?? 'default'
  const themeStyle = getThemeStyle(slug)
  const onWinReward = useCallback(() => void refresh(), [refresh])

  const seedParam = searchParams.get('seed')
  const diffParam = searchParams.get('difficulty')
  const seedFromUrl = seedParam ? Number(seedParam) : undefined
  const presetFromUrl = diffParam ? DIFFICULTY_PRESETS[diffParam] : undefined

  const [chosen, setChosen] = useState<Difficulty | null>(presetFromUrl ?? null)
  const [sessionId, setSessionId] = useState(0)

  const initialSeed = useMemo(
    () => (chosen === presetFromUrl && seedFromUrl !== undefined ? seedFromUrl : undefined),
    [chosen, presetFromUrl, seedFromUrl],
  )

  const onPick = (d: Difficulty) => {
    if (seedParam || diffParam) {
      // clear retry params when user picks fresh
      setSearchParams({}, { replace: true })
    }
    setChosen(d)
    setSessionId((n) => n + 1)
  }

  const onChangeDifficulty = () => {
    setSearchParams({}, { replace: true })
    setChosen(null)
  }

  if (loading) {
    return <div className={styles.centered}>{t('loading')}</div>
  }

  if (!chosen) {
    return (
      <>
        {!user && (
          <div className={styles.banner}>
            <span>
              {t('guestBannerPrefix')} <strong>{t('guestBannerRegister')}</strong> {t('guestBannerOr')}{' '}
              <strong>{t('guestBannerLogin')}</strong> {t('guestBannerSuffix')}
            </span>
          </div>
        )}
        <DifficultyPicker onPick={onPick} />
      </>
    )
  }

  return (
    <Game
      key={`${chosen.slug ?? 'custom'}-${chosen.rows}-${chosen.cols}-${chosen.mines}-${sessionId}-${initialSeed ?? 'fresh'}`}
      difficulty={chosen}
      seed={initialSeed}
      themeStyle={themeStyle}
      onWinReward={user ? onWinReward : undefined}
      onChangeDifficulty={onChangeDifficulty}
    />
  )
}
