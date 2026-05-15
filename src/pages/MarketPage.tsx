import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  equipMarketItem,
  equipTheme,
  getMarketCatalog,
  purchaseMarketItem,
  purchaseTheme,
  type MarketTheme,
} from '../api/client'
import { MineIcon } from '../components/Cell/icons/MineIcon'
import { ProfileAvatar } from '../components/Profile/ProfileAvatar'
import { useAuth } from '../auth/useAuth'
import type {
  CosmeticKind,
  MarketItemBase,
  MarketMineSkin,
  MarketProfileFlair,
  MarketVictoryEffect,
} from '../cosmetics/types'
import { useLanguage } from '../i18n/languageContext'
import type { TranslationKey } from '../i18n/translations'
import styles from './Pages.module.css'

type ShopTab = 'themes' | 'mines' | 'victory' | 'flair'

function ShopRow<T extends MarketItemBase>(props: {
  item: T
  preview: ReactNode
  proLocked: boolean
  busy: boolean
  coins: number
  onBuy: () => void
  onEquip: () => void
  t: (key: TranslationKey) => string
}) {
  const { item, preview, proLocked, busy, coins, onBuy, onEquip, t } = props
  return (
    <li className={styles.themeCard}>
      <div className={styles.shopPreview}>{preview}</div>
      <div>
        <div className={styles.themeName}>
          {item.name}
          {item.proOnly ? <span className={styles.proBadge}>{t('pro')}</span> : null}
        </div>
        <div className={styles.themeSlug}>{item.slug}</div>
      </div>
      <div className={styles.themeActions}>
        {proLocked ? (
          <Link to="/upgrade">
            <button type="button" className={styles.smallBtn}>
              {t('upgradeToUnlock')}
            </button>
          </Link>
        ) : item.equipped ? (
          <span className={styles.badge}>{t('equipped')}</span>
        ) : item.owned ? (
          <button type="button" className={styles.smallBtn} disabled={busy} onClick={onEquip}>
            {t('equip')}
          </button>
        ) : (
          <>
            <span className={styles.price}>
              {item.priceCoins === 0 ? t('free') : `${item.priceCoins} ${t('coins')}`}
            </span>
            <button
              type="button"
              className={styles.smallBtn}
              disabled={busy || coins < item.priceCoins}
              onClick={onBuy}
            >
              {t('buy')}
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export function MarketPage() {
  const { user, loading, refresh } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState<ShopTab>('themes')
  const [themes, setThemes] = useState<MarketTheme[]>([])
  const [mineSkins, setMineSkins] = useState<MarketMineSkin[]>([])
  const [victoryEffects, setVictoryEffects] = useState<MarketVictoryEffect[]>([])
  const [profileFlairs, setProfileFlairs] = useState<MarketProfileFlair[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  async function load() {
    if (!user) return
    try {
      const catalog = await getMarketCatalog()
      setThemes(catalog.themes)
      setMineSkins(catalog.mineSkins)
      setVictoryEffects(catalog.victoryEffects)
      setProfileFlairs(catalog.profileFlairs)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('failedLoadMarket'))
    }
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void getMarketCatalog()
      .then((catalog) => {
        if (!cancelled) {
          setThemes(catalog.themes)
          setMineSkins(catalog.mineSkins)
          setVictoryEffects(catalog.victoryEffects)
          setProfileFlairs(catalog.profileFlairs)
          setErr(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : t('failedLoadMarket'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [user, t])

  if (loading) {
    return <div className={styles.centered}>{t('loading')}</div>
  }

  if (!user) {
    return (
      <div className={styles.formPage}>
        <h1 className={styles.h1}>{t('market')}</h1>
        <p className={styles.muted}>
          <Link to="/login">{t('logIn')}</Link> {t('guestBannerOr')}{' '}
          <Link to="/register">{t('register')}</Link> {t('marketLoginPrompt')}
        </p>
      </div>
    )
  }

  async function buyTheme(theme: MarketTheme) {
    setBusyKey(`theme-${theme.id}`)
    setErr(null)
    try {
      await purchaseTheme(theme.id)
      await refresh()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('purchaseFailed'))
    } finally {
      setBusyKey(null)
    }
  }

  async function buyItem(kind: CosmeticKind, itemId: number) {
    setBusyKey(`${kind}-${itemId}`)
    setErr(null)
    try {
      await purchaseMarketItem(kind, itemId)
      await refresh()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('purchaseFailed'))
    } finally {
      setBusyKey(null)
    }
  }

  async function equipItemKind(kind: CosmeticKind, itemId: number) {
    setBusyKey(`eq-${kind}-${itemId}`)
    setErr(null)
    try {
      await equipMarketItem(kind, itemId)
      await refresh()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('equipFailed'))
    } finally {
      setBusyKey(null)
    }
  }

  async function equipThemeItem(theme: MarketTheme) {
    setBusyKey(`eq-theme-${theme.id}`)
    setErr(null)
    try {
      await equipTheme(theme.id)
      await refresh()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('equipFailed'))
    } finally {
      setBusyKey(null)
    }
  }

  const tabs: { id: ShopTab; labelKey: TranslationKey }[] = [
    { id: 'themes', labelKey: 'shopTabThemes' },
    { id: 'mines', labelKey: 'shopTabMines' },
    { id: 'victory', labelKey: 'shopTabVictory' },
    { id: 'flair', labelKey: 'shopTabFlair' },
  ]

  return (
    <div className={styles.market}>
      <h1 className={styles.h1}>{t('shopTitle')}</h1>
      <p className={styles.lead}>
        {t('shopLead')} {t('yourBalance')} <strong>{user.coins}</strong> {t('coins')}.
        {!user.isPro && (
          <>
            {' '}
            <Link to="/upgrade" className={styles.upgradeInlineLink}>
              {t('unlockProThemes')}
            </Link>
          </>
        )}
      </p>

      <div className={styles.shopTabs} role="tablist" aria-label={t('shopTabsLabel')}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`${styles.shopTab} ${tab === item.id ? styles.shopTabActive : ''}`}
            onClick={() => setTab(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {err && <p className={styles.error}>{err}</p>}

      {tab === 'themes' && (
        <ul className={styles.themeList}>
          {themes.map((theme) => (
            <ShopRow
              key={theme.id}
              item={theme}
              preview={<span className={styles.accentDot} data-accent={theme.slug} />}
              proLocked={theme.proOnly && !user.isPro}
              busy={busyKey === `theme-${theme.id}` || busyKey === `eq-theme-${theme.id}`}
              coins={user.coins}
              t={t}
              onBuy={() => void buyTheme(theme)}
              onEquip={() => void equipThemeItem(theme)}
            />
          ))}
        </ul>
      )}

      {tab === 'mines' && (
        <ul className={styles.themeList}>
          {mineSkins.map((skin) => (
            <ShopRow
              key={skin.id}
              item={skin}
              preview={<MineIcon className={styles.previewMine} variant={skin.variant} />}
              proLocked={skin.proOnly && !user.isPro}
              busy={busyKey === `mine_skin-${skin.id}` || busyKey === `eq-mine_skin-${skin.id}`}
              coins={user.coins}
              t={t}
              onBuy={() => void buyItem('mine_skin', skin.id)}
              onEquip={() => void equipItemKind('mine_skin', skin.id)}
            />
          ))}
        </ul>
      )}

      {tab === 'victory' && (
        <ul className={styles.themeList}>
          {victoryEffects.map((effect) => (
            <ShopRow
              key={effect.id}
              item={effect}
              preview={
                <span className={styles.previewVictory}>
                  {effect.variant === 'fireworks' ? '🎆' : effect.variant === 'sparkles' ? '✨' : '🎊'}
                </span>
              }
              proLocked={effect.proOnly && !user.isPro}
              busy={
                busyKey === `victory_effect-${effect.id}` ||
                busyKey === `eq-victory_effect-${effect.id}`
              }
              coins={user.coins}
              t={t}
              onBuy={() => void buyItem('victory_effect', effect.id)}
              onEquip={() => void equipItemKind('victory_effect', effect.id)}
            />
          ))}
        </ul>
      )}

      {tab === 'flair' && (
        <ul className={styles.themeList}>
          {profileFlairs.map((flair) => (
            <ShopRow
              key={flair.id}
              item={flair}
              preview={
                <ProfileAvatar
                  label={user.displayName || user.email}
                  frameClass={flair.frameClass}
                  badgeEmoji={flair.badgeEmoji || undefined}
                />
              }
              proLocked={flair.proOnly && !user.isPro}
              busy={
                busyKey === `profile_flair-${flair.id}` ||
                busyKey === `eq-profile_flair-${flair.id}`
              }
              coins={user.coins}
              t={t}
              onBuy={() => void buyItem('profile_flair', flair.id)}
              onEquip={() => void equipItemKind('profile_flair', flair.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
