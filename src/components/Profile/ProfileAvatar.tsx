import styles from './ProfileAvatar.module.css'

type ProfileAvatarProps = {
  label: string
  frameClass?: string
  badgeEmoji?: string
  size?: 'md' | 'lg'
}

export function ProfileAvatar(props: ProfileAvatarProps) {
  const { label, frameClass = 'flair-plain', badgeEmoji, size = 'md' } = props
  const initial = (label.trim()[0] ?? '?').toUpperCase()
  const frameStyles = styles[frameClass as keyof typeof styles]

  return (
    <div className={`${styles.wrap} ${size === 'lg' ? styles.lg : ''}`}>
      <div className={`${styles.frame} ${frameStyles ?? ''}`}>
        <span className={styles.initial} aria-hidden="true">
          {initial}
        </span>
      </div>
      {badgeEmoji ? (
        <span className={styles.badge} aria-hidden="true">
          {badgeEmoji}
        </span>
      ) : null}
    </div>
  )
}
