import { useLanguage } from '../../i18n/languageContext'
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
      >
        <span className={styles.icon} aria-hidden="true">
          💣
        </span>
        <span className={styles.label}>{t('revealLabel')}</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={flagMode}
        className={`${styles.option} ${flagMode ? styles.active : ''}`}
        onClick={() => onChange(true)}
        title={t('flagModeTitle')}
      >
        <span className={styles.icon} aria-hidden="true">
          🚩
        </span>
        <span className={styles.label}>{t('flagLabel')}</span>
      </button>
    </div>
  )
}
