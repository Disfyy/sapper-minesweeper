import { useState, type FormEventHandler } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/languageContext'
import { Button } from '../ui/Button/Button'
import { Input } from '../ui/Input/Input'
import styles from './Pages.module.css'

export function RegisterPage() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onSubmit: FormEventHandler = async (e) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await register({
        email,
        password,
        username,
        city: city || undefined,
      })
      await refresh()
      nav('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('registrationFailed')
      setError(
        msg === 'Username already taken' ? t('usernameTaken') : msg === 'Failed to fetch' ? t('apiUnreachable') : msg,
      )
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
          label={t('username')}
          hint={t('usernameHint')}
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]+"
          required
        />
        <Input
          label={t('cityOptional')}
          hint={t('cityHint')}
          placeholder={t('cityPlaceholder')}
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={64}
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
