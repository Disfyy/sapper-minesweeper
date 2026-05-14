import type { ComponentPropsWithoutRef } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

export function Button(props: ButtonProps) {
  const { variant = 'secondary', size = 'md', fullWidth, className, ...rest } = props
  const cls = [
    styles.btn,
    styles[`v_${variant}`],
    styles[`s_${size}`],
    fullWidth ? styles.full : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return <button {...rest} className={cls} />
}
