import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createMatch, getDifficulties, joinMatch, type DifficultyPreset } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/languageContext'
import type { TranslationKey } from '../i18n/translations'
import { Button } from '../ui/Button/Button'
import { Card } from '../ui/Card/Card'
import { Input } from '../ui/Input/Input'
import styles from './Duel.module.css'
import pageStyles from './Pages.module.css'

function difficultyLabel(slug: string, t: (key: TranslationKey) => string): string {
  if (slug === 'beginner') return t('beginner')
  if (slug === 'intermediate') return t('intermediate')
  if (slug === 'expert') return t('expert')
  if (slug === 'speed') return t('speed')
  return slug
}

export function DuelPage() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [presets, setPresets] = useState<DifficultyPreset[]>([])
  const [selectedPreset, setSelectedPreset] = useState('beginner')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await getDifficulties()
        if (cancelled) return
        setPresets(loaded)
        setSelectedPreset(loaded[0]?.slug ?? 'beginner')
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : t('duelConnectFailed'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const selected = useMemo(
    () => presets.find((preset) => preset.slug === selectedPreset) ?? presets[0] ?? null,
    [presets, selectedPreset],
  )

  const onCreate = async () => {
    if (!selected) return
    setBusy('create')
    setError(null)
    try {
      const match = await createMatch({ presetSlug: selected.slug })
      navigate(`/duel/${match.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('duelConnectFailed'))
    } finally {
      setBusy(null)
    }
  }

  const onJoin = async () => {
    setBusy('join')
    setError(null)
    try {
      const match = await joinMatch({ code: roomCode })
      navigate(`/duel/${match.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('duelConnectFailed'))
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className={pageStyles.centered}>{t('loading')}</div>
  if (!user) {
    return (
      <div className={pageStyles.formPage}>
        <h1 className={pageStyles.h1}>{t('duelTitle')}</h1>
        <p className={pageStyles.muted}>
          <Link to="/login">{t('logIn')}</Link> {t('duelLoginPrompt')}
        </p>
      </div>
    )
  }

  return (
    <div className={styles.lobby}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.title}>{t('duelTitle')}</h1>
          <p className={styles.lead}>{t('duelLead')}</p>
        </div>
      </header>

      {error && <p className={pageStyles.error}>{error}</p>}

      <section className={styles.lobbyGrid}>
        <Card title={t('duelCreateRoom')} subtitle={selected ? `${selected.rows}×${selected.cols} · ${selected.mines} ${t('mines')}` : undefined}>
          <div className={styles.formStack}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('duelDifficulty')}</span>
              <select
                className={styles.select}
                value={selectedPreset}
                onChange={(event) => setSelectedPreset(event.target.value)}
              >
                {presets.map((preset) => (
                  <option key={preset.slug} value={preset.slug}>
                    {difficultyLabel(preset.slug, t)} · {preset.rows}×{preset.cols}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="primary" onClick={() => void onCreate()} disabled={!selected || busy !== null}>
              {busy === 'create' ? t('duelCreating') : t('duelCreateAction')}
            </Button>
          </div>
        </Card>

        <Card title={t('duelJoinWithCode')} subtitle={t('duelShareCode')}>
          <div className={styles.formStack}>
            <Input
              label={t('duelRoomCode')}
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
            />
            <Button
              variant="secondary"
              onClick={() => void onJoin()}
              disabled={busy !== null || roomCode.trim().length < 4}
            >
              {busy === 'join' ? t('duelJoining') : t('duelJoinAction')}
            </Button>
          </div>
        </Card>
      </section>
    </div>
  )
}
