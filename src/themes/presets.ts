import type { CSSProperties } from 'react'

/**
 * Legacy compat shim. The real theme system now lives in `src/theme/ThemeProvider.tsx`
 * and applies `data-theme` / `data-accent` to <html>. CSS variables are defined in
 * `src/theme/tokens.css`.
 *
 * `getThemeStyle()` is intentionally inert — kept so existing call sites (PlayPage, Game)
 * keep type-checking while we phase them out.
 */
export type ThemeVars = CSSProperties

const EMPTY: ThemeVars = {}

export function getThemeStyle(slug?: string | null): ThemeVars {
  void slug
  return EMPTY
}

export const ACCENT_SLUGS = ['default', 'ocean', 'forest', 'neon'] as const
export type AccentSlugLegacy = (typeof ACCENT_SLUGS)[number]
