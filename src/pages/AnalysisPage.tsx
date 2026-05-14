import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getGame, type GameDetail } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Board } from '../components/Board/Board'
import { replayMoves } from '../features/play/replayMoves'
import type { Difficulty } from '../game/types'
import { useLanguage } from '../i18n/LanguageProvider'
import { getThemeStyle } from '../themes/presets'
import { Button } from '../ui/Button/Button'
import { Card } from '../ui/Card/Card'
import styles from './Pages.module.css'

function formatDuration(ms: number): string {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const min = Math.floor(s / 60)
  const rem = s - min * 60
  return `${min}m ${rem.toFixed(0)}s`
}

export function AnalysisPage() {
  const { user, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [game, setGame] = useState<GameDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !user) return
    let cancelled = false
    void (async () => {
      try {
        const g = await getGame(id)
        if (cancelled) return
        setGame(g)
        setErr(null)
      } catch (e) {
        if (cancelled) return
        setErr(e instanceof Error ? e.message : t('failedLoadGame'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, user, t])

  const finalState = useMemo(() => {
    if (!game) return null
    const difficulty: Difficulty = {
      rows: game.rows,
      cols: game.cols,
      mines: game.mines,
      slug: game.presetSlug ?? undefined,
    }
    return replayMoves(difficulty, game.seed, game.moves)
  }, [game])

  const difficultyLabel = (slug: string | null | undefined): string => {
    if (slug === 'beginner') return t('beginner')
    if (slug === 'intermediate') return t('intermediate')
    if (slug === 'expert') return t('expert')
    if (slug === 'speed') return t('speed')
    return t('custom')
  }
  const outcomeLabel = (status: string): string => {
    if (status === 'won') return t('win')
    if (status === 'lost') return t('loss')
    return t('abandoned')
  }

  if (authLoading) return <div className={styles.centered}>{t('loading')}</div>
  if (!user) {
    return (
      <div className={styles.formPage}>
        <h1 className={styles.h1}>{t('gameAnalysis')}</h1>
        <p className={styles.muted}>
          <Link to="/login">{t('logIn')}</Link> {t('analysisLoginPrompt')}
        </p>
      </div>
    )
  }

  if (loading) return <div className={styles.centered}>{t('loadingGame')}</div>
  if (err || !game || !finalState) {
    return (
      <div className={styles.formPage}>
        <h1 className={styles.h1}>{t('gameAnalysis')}</h1>
        <p className={styles.error}>{err ?? t('gameNotFound')}</p>
        <Link to="/history">{t('backToHistory')}</Link>
      </div>
    )
  }

  const themeStyle = getThemeStyle(user.equippedThemeSlug ?? 'default')
  const retryHref = game.presetSlug
    ? `/play?seed=${game.seed}&difficulty=${game.presetSlug}`
    : `/play?seed=${game.seed}`

  return (
    <div className={styles.analysis} style={themeStyle}>
      <header className={styles.analysisHead}>
        <div>
          <h1 className={styles.h1}>{t('gameNumber', { id: game.id })}</h1>
          <p className={styles.muted}>
            {new Date(game.endedAt).toLocaleString()} ·{' '}
            {difficultyLabel(game.presetSlug)}{' '}
            · {game.rows}×{game.cols} · {game.mines} {t('mines')}
          </p>
        </div>
        <div className={styles.analysisActions}>
          <Button variant="secondary" onClick={() => nav('/history')}>
            {t('back')}
          </Button>
          {game.presetSlug ? (
            <Link to={retryHref}>
              <Button variant="primary">{t('retrySameSeed')}</Button>
            </Link>
          ) : null}
        </div>
      </header>

      <div className={styles.analysisGrid}>
        <Card>
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>{t('outcome')}</div>
              <div className={game.status === 'won' ? styles.win : styles.loss}>
                {outcomeLabel(game.status)}
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>{t('time')}</div>
              <div className={styles.statValue}>{formatDuration(game.durationMs)}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>{t('score')}</div>
              <div className={styles.statValue}>{game.score}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>{t('moves')}</div>
              <div className={styles.statValue}>{game.moves.length}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>{t('seed')}</div>
              <div className={styles.statValue}>{game.seed}</div>
            </div>
          </div>
        </Card>

        <div className={styles.boardWrap}>
          <Board
            board={finalState.board}
            status={finalState.status}
            focus={{ row: 0, col: 0 }}
            setFocus={() => {}}
            onReveal={() => {}}
            onToggleFlag={() => {}}
          />
        </div>
      </div>
    </div>
  )
}
