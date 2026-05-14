import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import styles from './Input.module.css'

type InputProps = ComponentPropsWithoutRef<'input'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  const { label, hint, error, id, className, ...rest } = props
  const reactId = useId()
  const inputId = id ?? reactId

  const inputEl = (
    <input
      {...rest}
      ref={ref}
      id={inputId}
      className={[styles.input, error ? styles.invalid : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    />
  )

  if (!label && !hint && !error) return inputEl

  return (
    <div className={styles.row}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      {inputEl}
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  )
})
