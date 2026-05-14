import { useState, type FormEventHandler } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmProCheckout } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/languageContext'
import { Button } from '../ui/Button/Button'
import styles from './Pages.module.css'

function formatCard(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function CheckoutPage() {
  const { user, loading: authLoading, refresh } = useAuth()
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session') ?? ''

  const [card, setCard] = useState('4242 4242 4242 4242')
  const [expiry, setExpiry] = useState('12/29')
  const [cvc, setCvc] = useState('123')
  const [name, setName] = useState('Demo User')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const checkoutError = err ?? (!sessionId ? t('missingCheckout') : null)

  if (authLoading) return <div className={styles.centered}>{t('loading')}</div>
  if (!user) {
    return (
      <div className={styles.formPage}>
        <h1 className={styles.h1}>{t('checkout')}</h1>
        <p className={styles.muted}>
          {t('checkoutLoginPrompt')} <Link to="/login">{t('logIn')}</Link>.
        </p>
      </div>
    )
  }

  const onSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    if (!sessionId) return
    setSubmitting(true)
    setErr(null)
    // Simulate a payment provider's network round-trip.
    await new Promise((resolve) => window.setTimeout(resolve, 1200))
    try {
      await confirmProCheckout(sessionId)
      await refresh()
      navigate('/profile?upgraded=1')
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('paymentConfirmationFailed'))
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.checkout}>
      <h1 className={styles.checkoutBrand}>{t('checkoutBrand')}</h1>
      <p className={styles.checkoutLead}>
        {t('checkoutLead')}
      </p>

      <form className={styles.checkoutGrid} onSubmit={onSubmit}>
        <div>
          <div className={styles.checkoutLabel}>{t('cardholderName')}</div>
          <input
            className={styles.checkoutField}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="cc-name"
            required
          />
        </div>

        <div>
          <div className={styles.checkoutLabel}>{t('cardNumber')}</div>
          <input
            className={styles.checkoutField}
            value={card}
            inputMode="numeric"
            onChange={(e) => setCard(formatCard(e.target.value))}
            autoComplete="cc-number"
            required
          />
        </div>

        <div className={styles.checkoutRow}>
          <div>
            <div className={styles.checkoutLabel}>{t('expiry')}</div>
            <input
              className={styles.checkoutField}
              value={expiry}
              inputMode="numeric"
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              placeholder="MM/YY"
              autoComplete="cc-exp"
              required
            />
          </div>
          <div>
            <div className={styles.checkoutLabel}>CVC</div>
            <input
              className={styles.checkoutField}
              value={cvc}
              inputMode="numeric"
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
              autoComplete="cc-csc"
              required
            />
          </div>
        </div>

        <div className={styles.checkoutTotal}>
          <span>{t('checkoutTotal')}</span>
          <span>$4.99 USD</span>
        </div>

        {checkoutError && <p className={styles.error}>{checkoutError}</p>}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={submitting || !sessionId}
        >
          {submitting ? t('processing') : t('pay')}
        </Button>

        <p className={styles.checkoutFooter}>
          {t('checkoutFooter')}
        </p>
      </form>
    </section>
  )
}
