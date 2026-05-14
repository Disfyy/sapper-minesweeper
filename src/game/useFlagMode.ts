import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'ms.flagMode'

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Owns the user-visible flag/reveal mode. When `flagMode` is true, a primary
 * click toggles a flag on the cell instead of revealing it. Right-click and
 * long-press are always-on shortcuts for flagging and remain unchanged.
 *
 * Press `T` anywhere on the page to flip the mode.
 */
export function useFlagMode() {
  const [flagMode, setFlagMode] = useState<boolean>(() => readStored())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, flagMode ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [flagMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 't') return
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      setFlagMode((m) => !m)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggle = useCallback(() => setFlagMode((m) => !m), [])
  return { flagMode, setFlagMode, toggle }
}
