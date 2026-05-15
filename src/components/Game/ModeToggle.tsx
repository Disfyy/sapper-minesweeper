import { useLanguage } from '../../i18n/languageContext'
import { FlagIcon } from '../Cell/icons/FlagIcon'
import styles from './ModeToggle.module.css'

export function ModeToggle(props: { flagMode: boolean; onChange: (v: boolean) => void }) {
  const { flagMode, onChange } = props
  const { t } = useLanguage()
  return (
    <div className={styles.group} role="radiogroup" aria-label={t('clickAction')}>
      <button
        type="button"
        role="radio"
        aria-checked={!flagMode}
        className={`${styles.option} ${!flagMode ? styles.active : ''}`}
        onClick={() => onChange(false)}
        title={t('revealModeTitle')}
        aria-label={t('revealLabel')}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={styles.icon}
        >
          <path
            d="M12 4l-2 4h-3l3 3-1 4 3-2 3 2-1-4 3-3h-3z"
            fill="currentColor"
          />
        </svg>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={flagMode}
        className={`${styles.option} ${flagMode ? styles.active : ''}`}
        onClick={() => onChange(true)}
        title={t('flagModeTitle')}
        aria-label={t('flagLabel')}
      >
        <FlagIcon className={styles.icon} />
      </button>
    </div>
  )
}
