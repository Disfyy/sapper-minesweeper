import { useMemo } from 'react'
import styles from './Sparkles.module.css'

function fraction(seed: number): number {
  const value = Math.sin(seed * 73.891) * 10000
  return value - Math.floor(value)
}

export function Sparkles(props: { count?: number }) {
  const count = props.count ?? 24
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: 8 + fraction(i + 3) * 84,
        top: 10 + fraction(i + 17) * 70,
        delay: fraction(i + 29) * 0.4,
        scale: 0.6 + fraction(i + 41) * 1.1,
        rotate: Math.floor(fraction(i + 59) * 360),
      })),
    [count],
  )

  return (
    <div className={styles.layer} aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className={styles.star}
          style={
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              animationDelay: `${s.delay}s`,
              transform: `rotate(${s.rotate}deg) scale(${s.scale})`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
