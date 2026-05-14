import { useState, type FormEventHandler } from 'react'
import {
  BEGINNER_DIFFICULTY,
  EXPERT_DIFFICULTY,
  INTERMEDIATE_DIFFICULTY,
  SPEED_DIFFICULTY,
  type Difficulty,
} from '../../game/types'
import { useLanguage } from '../../i18n/languageContext'
import type { TranslationKey } from '../../i18n/translations'
import { Button } from '../../ui/Button/Button'
import { Card } from '../../ui/Card/Card'
import { Input } from '../../ui/Input/Input'
import styles from './DifficultyPicker.module.css'

type Props = {
  onPick: (difficulty: Difficulty) => void
}

const PRESETS: Array<{ key: string; d: Difficulty; labelKey: TranslationKey; taglineKey: TranslationKey }> = [
  { key: 'beginner', d: BEGINNER_DIFFICULTY, labelKey: 'beginner', taglineKey: 'beginnerTagline' },
  {
    key: 'intermediate',
    d: INTERMEDIATE_DIFFICULTY,
    labelKey: 'intermediate',
    taglineKey: 'intermediateTagline',
  },
  { key: 'expert', d: EXPERT_DIFFICULTY, labelKey: 'expert', taglineKey: 'expertTagline' },
  {
    key: 'speed',
    d: SPEED_DIFFICULTY,
    labelKey: 'speed',
    taglineKey: 'speedTagline',
  },
]

const MAX_DIM = 40
const MIN_DIM = 5

function clampCustom(rows: number, cols: number, mines: number) {
  const r = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(rows) || 0))
  const c = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(cols) || 0))
  const maxMines = Math.max(1, r * c - 1)
  const m = Math.max(1, Math.min(maxMines, Math.floor(mines) || 0))
  return { rows: r, cols: c, mines: m }
}

export function DifficultyPicker({ onPick }: Props) {
  const { t } = useLanguage()
  const [customRows, setCustomRows] = useState(12)
  const [customCols, setCustomCols] = useState(12)
  const [customMines, setCustomMines] = useState(25)
  const [customError, setCustomError] = useState<string | null>(null)

  const onCustomSubmit: FormEventHandler = (e) => {
    e.preventDefault()
    setCustomError(null)
    const next = clampCustom(customRows, customCols, customMines)
    if (next.mines >= next.rows * next.cols) {
      setCustomError(t('minesLessThanCells'))
      return
    }
    onPick(next)
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.h1}>{t('pickDifficulty')}</h1>
        <p className={styles.lead}>
          {t('pickDifficultyLead')}
        </p>
      </header>

      <div className={styles.grid}>
        {PRESETS.map(({ key, d, labelKey, taglineKey }) => (
          <Card
            key={key}
            title={t(labelKey)}
            subtitle={
              key === 'speed' ? `${d.rows} × ${d.cols} · ${t('timer2')}` : `${d.rows} × ${d.cols} · ${d.mines} ${t('mines')}`
            }
            actions={
              <Button variant="primary" onClick={() => onPick(d)}>
                {t('play')}
              </Button>
            }
          >
            <p className={styles.body}>{t(taglineKey)}</p>
          </Card>
        ))}

        <Card title={t('custom')} subtitle={t('customSubtitle')}>
          <form className={styles.customForm} onSubmit={onCustomSubmit}>
            <div className={styles.fields}>
              <Input
                label={t('rows')}
                type="number"
                min={MIN_DIM}
                max={MAX_DIM}
                value={customRows}
                onChange={(e) => setCustomRows(Number(e.target.value))}
              />
              <Input
                label={t('cols')}
                type="number"
                min={MIN_DIM}
                max={MAX_DIM}
                value={customCols}
                onChange={(e) => setCustomCols(Number(e.target.value))}
              />
              <Input
                label={t('minesInput')}
                type="number"
                min={1}
                max={MAX_DIM * MAX_DIM - 1}
                value={customMines}
                onChange={(e) => setCustomMines(Number(e.target.value))}
              />
            </div>
            {customError && <p className={styles.err}>{customError}</p>}
            <Button type="submit" variant="primary" fullWidth>
              {t('startCustomGame')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
