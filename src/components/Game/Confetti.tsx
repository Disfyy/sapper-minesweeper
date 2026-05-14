import { useMemo } from 'react'
import styles from './Confetti.module.css'

const COLORS = ['#f43f5e', '#22c55e', '#3b82f6', '#facc15', '#a855f7', '#f97316', '#06b6d4']

function fraction(seed: number): number {
  const value = Math.sin(seed * 91.345) * 10000
  return value - Math.floor(value)
}

export function Confetti(props: { count?: number }) {
  const count = props.count ?? 28
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: fraction(i + 1) * 100,
        delay: fraction(i + 11) * 0.25,
        duration: 1.0 + fraction(i + 23) * 0.9,
        bg: COLORS[i % COLORS.length],
        rotate: Math.floor(fraction(i + 37) * 360),
        size: 6 + Math.floor(fraction(i + 53) * 7),
      })),
    [count],
  )
  return (
    <div className={styles.layer} aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={styles.piece}
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              background: p.bg,
              transform: `rotate(${p.rotate}deg)`,
              width: `${p.size}px`,
              height: `${p.size * 1.6}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
