import { useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useLanguage } from '../../i18n/languageContext'
import type { TranslationKey } from '../../i18n/translations'
import { normalizeAccent, useTheme } from '../../theme/themeContext'
import { Button } from '../../ui/Button/Button'
import { LanguageToggle } from './LanguageToggle'
import { MuteToggle } from './MuteToggle'
import { ThemeToggle } from './ThemeToggle'
import styles from './Layout.module.css'

type NavItem = {
  to: string
  labelKey: TranslationKey
  icon: string
  requiresAuth?: boolean
  /** Shown in the mobile bottom tab bar — max 4 items should set this. */
  mobile?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'navHome', icon: '🏠' },
  { to: '/play', labelKey: 'navPlay', icon: '▶️', mobile: true },
  { to: '/duel', labelKey: 'navDuel', icon: '⚔️', requiresAuth: true },
  { to: '/daily', labelKey: 'navDaily', icon: '⚡', mobile: true },
  { to: '/leaderboard', labelKey: 'navLeaderboard', icon: '🏆', mobile: true },
  { to: '/history', labelKey: 'navHistory', icon: '📜', requiresAuth: true },
  { to: '/market', labelKey: 'navShop', icon: '🛒' },
  { to: '/profile', labelKey: 'navProfile', icon: '👤', requiresAuth: true, mobile: true },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { setAccent } = useTheme()
  const { t } = useLanguage()

  useEffect(() => {
    setAccent(normalizeAccent(user?.equippedThemeSlug))
  }, [user?.equippedThemeSlug, setAccent])

  const visibleNav = NAV_ITEMS.filter((item) => !item.requiresAuth || user)
  const mobileNav = visibleNav.filter((item) => item.mobile)

  return (
    <div className={styles.shell}>
      {/* === Slim top utility bar — always visible, light-weight === */}
      <header className={styles.topBar}>
        <Link className={styles.brand} to="/">
          <span className={styles.brandMark} aria-hidden="true">
            💣
          </span>
          <span className={styles.brandText}>Sapper</span>
        </Link>
        <div className={styles.topRight}>
          <ThemeToggle />
          <LanguageToggle />
          <MuteToggle />
          {user ? (
            <span className={styles.userPill} title={user.email}>
              {user.isPro && (
                <span className={styles.proCrown} aria-label={t('proMember')}>
                  👑
                </span>
              )}
              <span className={styles.userName}>{user.displayName || user.email}</span>
              <span className={styles.coins}>{user.coins} 🪙</span>
            </span>
          ) : (
            <>
              <Button variant="ghost" size="sm" type="button" onClick={() => navigate('/login')}>
                {t('logIn')}
              </Button>
              <Button variant="primary" size="sm" type="button" onClick={() => navigate('/register')}>
                {t('signUp')}
              </Button>
            </>
          )}
        </div>
      </header>

      <div className={styles.body}>
        {/* === Desktop / tablet left sidebar === */}
        <aside className={styles.sidebar} aria-label={t('mainNavigation')}>
          <nav className={styles.sidebarNav}>
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive ? `${styles.sideLink} ${styles.sideLinkActive}` : styles.sideLink
                }
                title={t(item.labelKey)}
              >
                <span className={styles.sideIcon} aria-hidden="true">
                  {item.icon}
                </span>
                <span className={styles.sideLabel}>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className={styles.sidebarFoot}>
              <Button variant="ghost" size="sm" onClick={() => void logout()} fullWidth>
                {t('logOut')}
              </Button>
            </div>
          )}
        </aside>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>

      {/* === Mobile bottom tab bar === */}
      <nav className={styles.bottomTabs} aria-label={t('mainNavigation')}>
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
            }
          >
            <span className={styles.tabIcon} aria-hidden="true">
              {item.icon}
            </span>
            <span className={styles.tabLabel}>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
