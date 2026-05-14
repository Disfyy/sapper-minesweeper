import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { TranslationKey } from '../../i18n/translations'
import { normalizeAccent, useTheme } from '../../theme/themeContext'
import { Button } from '../../ui/Button/Button'
import { LanguageToggle } from './LanguageToggle'
import { MuteToggle } from './MuteToggle'
import { ThemeToggle } from './ThemeToggle'
import styles from './Layout.module.css'

type NavItem = { to: string; labelKey: TranslationKey; requiresAuth?: boolean }

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'navHome' },
  { to: '/play', labelKey: 'navPlay' },
  { to: '/daily', labelKey: 'navDaily' },
  { to: '/leaderboard', labelKey: 'navLeaderboard' },
  { to: '/history', labelKey: 'navHistory', requiresAuth: true },
  { to: '/market', labelKey: 'navShop' },
  { to: '/profile', labelKey: 'navProfile', requiresAuth: true },
]

export function Layout() {
  const { user, logout } = useAuth()
  const { setAccent } = useTheme()
  const { t } = useLanguage()

  useEffect(() => {
    setAccent(normalizeAccent(user?.equippedThemeSlug))
  }, [user?.equippedThemeSlug, setAccent])

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Main">
        <Link className={styles.brand} to="/">
          <span className={styles.brandMark} aria-hidden="true">
            💣
          </span>
          <span className={styles.brandText}>Sapper</span>
        </Link>
        <div className={styles.links}>
          {NAV_ITEMS.filter((item) => !item.requiresAuth || user).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
        <div className={styles.right}>
          <ThemeToggle />
          <LanguageToggle />
          <MuteToggle />
          {user ? (
            <>
              <span className={styles.meta} title={user.email}>
                {user.isPro && (
                  <span className={styles.proCrown} aria-label={t('proMember')}>
                    👑
                  </span>
                )}
                {user.displayName || user.email} · {user.coins}🪙
              </span>
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                {t('logOut')}
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t('logIn')}
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  {t('signUp')}
                </Button>
              </Link>
            </>
          )}
        </div>
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
