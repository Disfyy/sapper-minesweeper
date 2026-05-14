import { createContext, useContext } from 'react'

export type ThemeMode = 'light' | 'dark'
export type AccentSlug = 'default' | 'ocean' | 'forest' | 'neon' | 'aurora' | 'sunset'

export const VALID_ACCENTS: AccentSlug[] = [
  'default',
  'ocean',
  'forest',
  'neon',
  'aurora',
  'sunset',
]

export type ThemeContextValue = {
  mode: ThemeMode
  accent: AccentSlug
  toggleMode: () => void
  setMode: (m: ThemeMode) => void
  setAccent: (a: AccentSlug) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export function normalizeAccent(slug: string | undefined | null): AccentSlug {
  if (!slug) return 'default'
  return (VALID_ACCENTS as string[]).includes(slug) ? (slug as AccentSlug) : 'default'
}
