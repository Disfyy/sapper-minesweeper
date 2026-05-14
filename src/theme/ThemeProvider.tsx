import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ThemeContext,
  VALID_ACCENTS,
  type AccentSlug,
  type ThemeContextValue,
  type ThemeMode,
} from './themeContext'

const MODE_KEY = 'ms.theme.mode'
const ACCENT_KEY = 'ms.theme.accent'

function readStoredMode(): ThemeMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function readStoredAccent(): AccentSlug | null {
  try {
    const v = localStorage.getItem(ACCENT_KEY)
    return v && (VALID_ACCENTS as string[]).includes(v) ? (v as AccentSlug) : null
  } catch {
    return null
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode() ?? (systemPrefersDark() ? 'dark' : 'light'))
  const [accent, setAccentState] = useState<AccentSlug>(() => readStoredAccent() ?? 'default')

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', mode)
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-accent', accent)
    try {
      localStorage.setItem(ACCENT_KEY, accent)
    } catch {
      /* ignore */
    }
  }, [accent])

  const setMode = useCallback((m: ThemeMode) => setModeState(m), [])
  const setAccent = useCallback((a: AccentSlug) => setAccentState(a), [])
  const toggleMode = useCallback(() => setModeState((m) => (m === 'dark' ? 'light' : 'dark')), [])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, accent, toggleMode, setMode, setAccent }),
    [mode, accent, toggleMode, setMode, setAccent],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
