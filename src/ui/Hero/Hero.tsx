import type { ReactNode } from 'react'
import styles from './Hero.module.css'

type HeroProps = {
  image?: string
  imageAlt?: string
  eyebrow?: ReactNode
  title: ReactNode
  tagline?: ReactNode
  actions?: ReactNode
  trust?: ReactNode
}

export function Hero(props: HeroProps) {
  const { image, imageAlt = '', eyebrow, title, tagline, actions, trust } = props
  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1 className={styles.title}>{title}</h1>
        {tagline && <p className={styles.tagline}>{tagline}</p>}
        {actions && <div className={styles.actions}>{actions}</div>}
        {trust && <p className={styles.trust}>{trust}</p>}
      </div>
      {image && (
        <div className={styles.art} aria-hidden={imageAlt ? undefined : true}>
          <img src={image} alt={imageAlt} className={styles.img} />
        </div>
      )}
    </section>
  )
}
