import { useLanguage } from '../../i18n/languageContext'
import { useTheme } from '../../theme/themeContext'
import styles from './ThemeToggle.module.css'

export function ThemeToggle() {
  const { mode, toggleMode } = useTheme()
  const { t } = useLanguage()
  const isDark = mode === 'dark'
  const label = isDark ? t('switchLightTheme') : t('switchDarkTheme')
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleMode}
      aria-label={label}
      title={label}
    >
      <span className={styles.icon} aria-hidden="true">
        {isDark ? '☀' : '☾'}
      </span>
    </button>
  )
}
