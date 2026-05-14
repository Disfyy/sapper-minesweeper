import { useMuted } from '../../audio/playSound'
import { useLanguage } from '../../i18n/LanguageProvider'
import styles from './ThemeToggle.module.css'

export function MuteToggle() {
  const [muted, setMuted] = useMuted()
  const { t } = useLanguage()
  const label = muted ? t('unmuteSounds') : t('muteSounds')
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setMuted(!muted)}
      aria-label={label}
      title={label}
    >
      <span className={styles.icon} aria-hidden="true">
        {muted ? '🔇' : '🔊'}
      </span>
    </button>
  )
}
