import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LanguageContext, type LanguageContextValue } from './languageContext'
import { LANGUAGE_OPTIONS, translations, type Language, type TranslationKey } from './translations'

const LANGUAGE_KEY = 'ms.language'

type Vars = Record<string, string | number>

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'ru'
}

function readStoredLanguage(): Language | null {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY)
    return isLanguage(value) ? value : null
  } catch {
    return null
  }
}

function browserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key]
    return value === undefined ? match : String(value)
  })
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage() ?? browserLanguage())

  useEffect(() => {
    document.documentElement.lang = language
    document.title = translations[language].appTitle
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', translations[language].appDescription)
    try {
      localStorage.setItem(LANGUAGE_KEY, language)
    } catch {
      /* ignore */
    }
  }, [language])

  const setLanguage = useCallback((next: Language) => setLanguageState(next), [])
  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => {
      const index = LANGUAGE_OPTIONS.findIndex((option) => option.code === current)
      return LANGUAGE_OPTIONS[(index + 1) % LANGUAGE_OPTIONS.length].code
    })
  }, [])
  const t = useCallback(
    (key: TranslationKey, vars?: Vars) => interpolate(translations[language][key], vars),
    [language],
  )

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
