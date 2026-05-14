import { useState, type FormEventHandler } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/languageContext'
import { Button } from '../ui/Button/Button'
import { Input } from '../ui/Input/Input'
import styles from './Pages.module.css'

export function LoginPage() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onSubmit: FormEventHandler = async (e) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await login({ email, password })
      await refresh()
      nav('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.formPage}>
      <h1 className={styles.h1}>{t('logIn')}</h1>
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
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className={styles.error}>{error}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={pending} fullWidth>
          {pending ? t('signingIn') : t('logIn')}
        </Button>
      </form>
      <p className={styles.muted}>
        {t('noAccount')} <Link to="/register">{t('register')}</Link>
      </p>
    </div>
  )
}
