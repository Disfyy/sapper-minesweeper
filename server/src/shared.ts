import { pool } from './db.js'
import { sessionCookieName, verifySessionToken } from './auth.js'

export const WIN_COINS = 25
export const WIN_DAILY_CAP = 200
export const WIN_MIN_INTERVAL_MS = 10_000
export const WIN_PER_MINUTE_MAX = 5

export type AuthedUser = {
  id: string
  email: string
  display_name: string | null
  city: string | null
  coins: number
  equipped_theme_id: number | null
  equipped_slug: string | null
  is_pro: boolean
}

export async function getUserFromRequest(req: {
  cookies: Record<string, string | undefined>
}): Promise<AuthedUser | null> {
  const raw = req.cookies[sessionCookieName]
  if (!raw) return null
  const v = verifySessionToken(raw)
  if (!v) return null
  const r = await pool.query<AuthedUser>(
    `SELECT u.id, u.email, u.display_name, u.city, u.coins, u.equipped_theme_id, t.slug AS equipped_slug, u.is_pro
     FROM users u
     LEFT JOIN themes t ON t.id = u.equipped_theme_id
     WHERE u.id = $1`,
    [v.userId],
  )
  return r.rows[0] ?? null
}

/** Trim and cap to 64 chars; returns null for empty input. React text rendering is auto-escaped. */
export function normalizeCity(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim().slice(0, 64)
  return trimmed || null
}
