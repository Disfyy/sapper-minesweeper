import { useState, type FormEventHandler } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/LanguageProvider'
import { Button } from '../ui/Button/Button'
import { Input } from '../ui/Input/Input'
import styles from './Pages.module.css'

export function RegisterPage() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onSubmit: FormEventHandler = async (e) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await register({ email, password, displayName: displayName || undefined })
      await refresh()
      nav('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registrationFailed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.formPage}>
      <h1 className={styles.h1}>{t('createAccount')}</h1>
      <form className={styles.form} onSubmit={onSubmit}>
        <Input
          label={t('email')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label={t('password')}
          hint={t('passwordHint')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <Input
          label={t('displayNameOptional')}
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={pending} fullWidth>
          {pending ? t('creating') : t('register')}
        </Button>
      </form>
      <p className={styles.muted}>
        {t('alreadyHaveAccount')} <Link to="/login">{t('logIn')}</Link>
      </p>
    </div>
  )
}
