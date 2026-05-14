import { useLanguage } from '../../i18n/LanguageProvider'
import { LANGUAGE_OPTIONS } from '../../i18n/translations'
import styles from './ThemeToggle.module.css'

export function LanguageToggle() {
  const { language, toggleLanguage, t } = useLanguage()
  const nextLanguage =
    LANGUAGE_OPTIONS[(LANGUAGE_OPTIONS.findIndex((option) => option.code === language) + 1) % LANGUAGE_OPTIONS.length]

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleLanguage}
      aria-label={t('languageToggleLabel')}
      title={t('languageToggleTitle')}
    >
      <span className={styles.languageText} aria-hidden="true">
        {nextLanguage.label}
      </span>
    </button>
  )
}
