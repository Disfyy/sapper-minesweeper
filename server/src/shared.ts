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
  equipped_mine_skin_id: number | null
  equipped_mine_slug: string | null
  equipped_mine_variant: string | null
  equipped_victory_effect_id: number | null
  equipped_victory_slug: string | null
  equipped_victory_variant: string | null
  equipped_profile_flair_id: number | null
  equipped_flair_slug: string | null
  equipped_flair_frame: string | null
  equipped_flair_badge: string | null
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
    `SELECT u.id, u.email, u.display_name, u.city, u.coins,
            u.equipped_theme_id, t.slug AS equipped_slug,
            u.equipped_mine_skin_id, ms.slug AS equipped_mine_slug, ms.variant AS equipped_mine_variant,
            u.equipped_victory_effect_id, ve.slug AS equipped_victory_slug, ve.variant AS equipped_victory_variant,
            u.equipped_profile_flair_id, pf.slug AS equipped_flair_slug,
            pf.frame_class AS equipped_flair_frame, pf.badge_emoji AS equipped_flair_badge,
            u.is_pro
     FROM users u
     LEFT JOIN themes t ON t.id = u.equipped_theme_id
     LEFT JOIN mine_skins ms ON ms.id = u.equipped_mine_skin_id
     LEFT JOIN victory_effects ve ON ve.id = u.equipped_victory_effect_id
     LEFT JOIN profile_flairs pf ON pf.id = u.equipped_profile_flair_id
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
