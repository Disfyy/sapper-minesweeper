import { useMemo } from 'react'
import styles from './Fireworks.module.css'

const BURST_COLORS = ['#f43f5e', '#22c55e', '#3b82f6', '#facc15', '#a855f7', '#f97316']

function fraction(seed: number): number {
  const value = Math.sin(seed * 47.123) * 10000
  return value - Math.floor(value)
}

export function Fireworks(props: { bursts?: number }) {
  const bursts = props.bursts ?? 5
  const pieces = useMemo(
    () =>
      Array.from({ length: bursts * 12 }, (_, i) => {
        const burst = Math.floor(i / 12)
        const angle = (i % 12) * 30 + fraction(burst + 1) * 12
        const rad = (angle * Math.PI) / 180
        const dist = 40 + fraction(i + 7) * 55
        return {
          left: 12 + fraction(burst + 3) * 76,
          bottom: 8 + fraction(burst + 11) * 28,
          dx: Math.cos(rad) * dist,
          dy: Math.sin(rad) * dist,
          delay: burst * 0.35 + fraction(i + 19) * 0.08,
          color: BURST_COLORS[i % BURST_COLORS.length],
          size: 4 + Math.floor(fraction(i + 31) * 5),
        }
      }),
    [bursts],
  )

  return (
    <div className={styles.layer} aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={styles.particle}
          style={
            {
              left: `${p.left}%`,
              bottom: `${p.bottom}%`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              animationDelay: `${p.delay}s`,
              background: p.color,
              width: `${p.size}px`,
              height: `${p.size}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
