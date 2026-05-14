import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import styles from './Card.module.css'

type CardProps = ComponentPropsWithoutRef<'div'> & {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  padded?: boolean
}

export function Card(props: CardProps) {
  const { title, subtitle, actions, padded = true, className, children, ...rest } = props
  return (
    <div
      {...rest}
      className={[styles.card, padded ? styles.padded : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {(title || actions) && (
        <div className={styles.head}>
          <div className={styles.titles}>
            {title && <div className={styles.title}>{title}</div>}
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
