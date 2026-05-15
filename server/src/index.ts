import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import bcrypt from 'bcrypt'
import 'dotenv/config'
import { pool } from './db.js'
import { getJwtSecret, sessionCookieName, signSessionToken } from './auth.js'
import { registerDailyRoutes } from './routes/daily.js'
import { registerGameRoutes } from './routes/games.js'
import { registerMatchRoutes } from './routes/matches.js'
import { grantDefaultCosmetics, registerMarketRoutes } from './routes/market.js'
import {
  getUserFromRequest,
  normalizeCity,
  WIN_COINS,
  WIN_DAILY_CAP,
  WIN_MIN_INTERVAL_MS,
  WIN_PER_MINUTE_MAX,
} from './shared.js'

if (!process.env.DATABASE_URL?.trim()) {
  console.error('DATABASE_URL is missing. Copy server/.env.example to server/.env and set it.')
  process.exit(1)
}
try {
  getJwtSecret()
} catch {
  console.error('JWT_SECRET is missing. Copy server/.env.example to server/.env and set JWT_SECRET.')
  process.exit(1)
}

const app = Fastify({ logger: true })

function clientOrigin(): string {
  return process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
}

const isProd = process.env.NODE_ENV === 'production'

function sessionCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60,
  }
}

app.register(cookie)
app.register(cors, {
  origin: clientOrigin(),
  credentials: true,
})
app.register(websocket)

app.get('/api/health', async () => ({ ok: true }))

app.post<{
  Body: { email?: string; password?: string; displayName?: string; city?: string }
}>('/api/auth/register', async (req, reply) => {
  const email = req.body?.email?.trim().toLowerCase()
  const password = req.body?.password ?? ''
  const displayName = req.body?.displayName?.trim() || null
  const city = normalizeCity(req.body?.city)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply.status(400).send({ error: 'Invalid email' })
  }
  if (password.length < 8) {
    return reply.status(400).send({ error: 'Password must be at least 8 characters' })
  }

  const hash = await bcrypt.hash(password, 12)

  const themeRes = await pool.query<{ id: number }>(
    `SELECT id FROM themes WHERE slug = 'default' LIMIT 1`,
  )
  const defaultThemeId = themeRes.rows[0]?.id
  if (!defaultThemeId) {
    return reply.status(500).send({ error: 'Server misconfiguration: no default theme' })
  }

  let userId: string
  try {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, display_name, city, coins, equipped_theme_id)
       VALUES ($1, $2, $3, $4, 500, $5)
       RETURNING id`,
      [email, hash, displayName, city, defaultThemeId],
    )
    userId = ins.rows[0]!.id
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err.code === '23505') {
      return reply.status(409).send({ error: 'Email already registered' })
    }
    throw e
  }

  await grantDefaultCosmetics(userId, defaultThemeId)

  const token = signSessionToken(userId)
  reply.setCookie(sessionCookieName, token, sessionCookieOptions())

  return { ok: true, userId }
})

app.post<{ Body: { email?: string; password?: string } }>('/api/auth/login', async (req, reply) => {
  const email = req.body?.email?.trim().toLowerCase()
  const password = req.body?.password ?? ''
  if (!email || !password) {
    return reply.status(400).send({ error: 'Email and password required' })
  }

  const r = await pool.query<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM users WHERE email = $1`,
    [email],
  )
  const row = r.rows[0]
  if (!row) {
    return reply.status(401).send({ error: 'Invalid credentials' })
  }
  const ok = await bcrypt.compare(password, row.password_hash)
  if (!ok) {
    return reply.status(401).send({ error: 'Invalid credentials' })
  }

  const token = signSessionToken(row.id)
  reply.setCookie(sessionCookieName, token, sessionCookieOptions())
  return { ok: true }
})

app.post('/api/auth/logout', async (_req, reply) => {
  reply.clearCookie(sessionCookieName, { path: '/' })
  return { ok: true }
})

app.get('/api/me', async (req, reply) => {
  const user = await getUserFromRequest(req)
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const owned = await pool.query<{ theme_id: number }>(
    `SELECT theme_id FROM user_themes WHERE user_id = $1`,
    [user.id],
  )
  const ownedThemeIds = owned.rows.map((o) => o.theme_id)

  return {
    email: user.email,
    displayName: user.display_name,
    city: user.city,
    coins: user.coins,
    equippedThemeId: user.equipped_theme_id,
    equippedThemeSlug: user.equipped_slug ?? 'default',
    equippedMineSkinSlug: user.equipped_mine_slug ?? 'classic-mine',
    equippedMineVariant: user.equipped_mine_variant ?? 'classic',
    equippedVictoryEffectSlug: user.equipped_victory_slug ?? 'confetti',
    equippedVictoryVariant: user.equipped_victory_variant ?? 'confetti',
    equippedProfileFlairSlug: user.equipped_flair_slug ?? 'plain',
    equippedProfileFlairFrame: user.equipped_flair_frame ?? 'flair-plain',
    equippedProfileFlairBadge: user.equipped_flair_badge ?? '',
    ownedThemeIds,
    isPro: user.is_pro,
  }
})

app.patch<{ Body: { city?: string | null } }>('/api/me/city', async (req, reply) => {
  const user = await getUserFromRequest(req)
  if (!user) return reply.status(401).send({ error: 'Unauthorized' })

  const city = req.body?.city === null ? null : normalizeCity(req.body?.city)
  await pool.query(`UPDATE users SET city = $1 WHERE id = $2`, [city, user.id])
  return { ok: true, city }
})

app.get('/api/leaderboard/cities', async () => {
  const r = await pool.query<{ city: string; player_count: number }>(
    `SELECT u.city, COUNT(*)::int AS player_count
     FROM users u
     JOIN games g ON g.user_id = u.id
     WHERE u.city IS NOT NULL AND u.city <> ''
     GROUP BY u.city
     ORDER BY player_count DESC, u.city ASC
     LIMIT 30`,
  )
  return { cities: r.rows.map((row) => ({ city: row.city, playerCount: row.player_count })) }
})

app.get('/api/me/stats', async (req, reply) => {
  const user = await getUserFromRequest(req)
  if (!user) return reply.status(401).send({ error: 'Unauthorized' })

  const r = await pool.query<{
    games_played: number
    wins: number
    best_time_beginner_ms: number | null
    best_time_intermediate_ms: number | null
    best_time_expert_ms: number | null
  }>(
    `SELECT games_played, wins, best_time_beginner_ms, best_time_intermediate_ms, best_time_expert_ms
     FROM user_stats WHERE user_id = $1`,
    [user.id],
  )
  const row = r.rows[0]
  return {
    gamesPlayed: row?.games_played ?? 0,
    wins: row?.wins ?? 0,
    bestTimeBeginnerMs: row?.best_time_beginner_ms ?? null,
    bestTimeIntermediateMs: row?.best_time_intermediate_ms ?? null,
    bestTimeExpertMs: row?.best_time_expert_ms ?? null,
  }
})

app.get('/api/market/themes', async (req, reply) => {
  const user = await getUserFromRequest(req)
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const themes = await pool.query<{
    id: number
    slug: string
    name: string
    price_coins: number
    pro_only: boolean
  }>(`SELECT id, slug, name, price_coins, pro_only FROM themes ORDER BY id`)

  const owned = new Set(
    (
      await pool.query<{ theme_id: number }>(
        `SELECT theme_id FROM user_themes WHERE user_id = $1`,
        [user.id],
      )
    ).rows.map((r) => r.theme_id),
  )

  return {
    themes: themes.rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      priceCoins: t.price_coins,
      owned: owned.has(t.id),
      equipped: user.equipped_theme_id === t.id,
      proOnly: t.pro_only,
    })),
    isPro: user.is_pro,
  }
})

app.post<{ Body: { themeId?: number } }>('/api/market/purchase', async (req, reply) => {
  const user = await getUserFromRequest(req)
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const themeId = req.body?.themeId
  if (typeof themeId !== 'number' || !Number.isInteger(themeId)) {
    return reply.status(400).send({ error: 'themeId required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const th = await client.query<{ price_coins: number; pro_only: boolean }>(
      `SELECT price_coins, pro_only FROM themes WHERE id = $1 FOR UPDATE`,
      [themeId],
    )
    if (th.rows.length === 0) {
      await client.query('ROLLBACK')
      return reply.status(404).send({ error: 'Theme not found' })
    }

    if (th.rows[0]!.pro_only && !user.is_pro) {
      await client.query('ROLLBACK')
      return reply.status(403).send({ error: 'Pro membership required', proRequired: true })
    }

    const own = await client.query(
      `SELECT 1 FROM user_themes WHERE user_id = $1 AND theme_id = $2`,
      [user.id, themeId],
    )
    if (own.rows.length > 0) {
      await client.query('ROLLBACK')
      return reply.status(409).send({ error: 'Already owned' })
    }

    const price = th.rows[0]!.price_coins
    const u = await client.query<{ coins: number }>(
      `SELECT coins FROM users WHERE id = $1 FOR UPDATE`,
      [user.id],
    )
    const coins = u.rows[0]?.coins ?? 0
    if (coins < price) {
      await client.query('ROLLBACK')
      return reply.status(402).send({ error: 'Insufficient coins' })
    }

    await client.query(`UPDATE users SET coins = coins - $1 WHERE id = $2`, [price, user.id])
    await client.query(`INSERT INTO user_themes (user_id, theme_id) VALUES ($1, $2)`, [
      user.id,
      themeId,
    ])

    await client.query('COMMIT')

    const after = await pool.query<{ coins: number }>(`SELECT coins FROM users WHERE id = $1`, [
      user.id,
    ])
    return { ok: true, coins: after.rows[0]?.coins ?? 0 }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
})

app.post<{ Body: { themeId?: number } }>('/api/me/equip', async (req, reply) => {
  const user = await getUserFromRequest(req)
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const themeId = req.body?.themeId
  if (typeof themeId !== 'number' || !Number.isInteger(themeId)) {
    return reply.status(400).send({ error: 'themeId required' })
  }

  const own = await pool.query(
    `SELECT 1 FROM user_themes WHERE user_id = $1 AND theme_id = $2`,
    [user.id, themeId],
  )
  if (own.rows.length === 0) {
    return reply.status(403).send({ error: 'Theme not owned' })
  }

  await pool.query(`UPDATE users SET equipped_theme_id = $1 WHERE id = $2`, [themeId, user.id])
  return { ok: true, equippedThemeId: themeId }
})

app.post('/api/rewards/win', async (req, reply) => {
  const user = await getUserFromRequest(req)
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setUTCHours(0, 0, 0, 0)

  const daily = await pool.query<{ sum: string }>(
    `SELECT COALESCE(SUM(coins_granted), 0)::text AS sum FROM win_reward_log
     WHERE user_id = $1 AND created_at >= $2`,
    [user.id, startOfDay.toISOString()],
  )
  const dailyTotal = Number(daily.rows[0]?.sum ?? 0)
  if (dailyTotal >= WIN_DAILY_CAP) {
    return reply.status(429).send({ error: 'Daily win reward cap reached', coins: user.coins })
  }

  const last = await pool.query<{ created_at: Date }>(
    `SELECT created_at FROM win_reward_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [user.id],
  )
  if (last.rows[0]) {
    const delta = now.getTime() - new Date(last.rows[0].created_at).getTime()
    if (delta < WIN_MIN_INTERVAL_MS) {
      return reply.status(429).send({ error: 'Too soon after last reward', coins: user.coins })
    }
  }

  const minuteAgo = new Date(now.getTime() - 60_000)
  const recent = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM win_reward_log WHERE user_id = $1 AND created_at >= $2`,
    [user.id, minuteAgo.toISOString()],
  )
  if (Number(recent.rows[0]?.c ?? 0) >= WIN_PER_MINUTE_MAX) {
    return reply.status(429).send({ error: 'Too many win rewards per minute', coins: user.coins })
  }

  const grant = Math.min(WIN_COINS, WIN_DAILY_CAP - dailyTotal)
  if (grant <= 0) {
    return reply.status(429).send({ error: 'Daily cap reached', coins: user.coins })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`UPDATE users SET coins = coins + $1 WHERE id = $2`, [grant, user.id])
    await client.query(`INSERT INTO win_reward_log (user_id, coins_granted) VALUES ($1, $2)`, [
      user.id,
      grant,
    ])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  const after = await pool.query<{ coins: number }>(`SELECT coins FROM users WHERE id = $1`, [
    user.id,
  ])
  return { ok: true, granted: grant, coins: after.rows[0]?.coins ?? user.coins }
})

// ---- Pro tier / fake checkout (demo monetization) ----

const PRO_PRICE_CENTS = 499

function makeSessionId(): string {
  // 24-byte random hex via Math.random is fine for a demo (not security-critical).
  let s = ''
  for (let i = 0; i < 6; i++) s += Math.random().toString(36).slice(2, 10)
  return s.slice(0, 32)
}

app.post('/api/billing/checkout', async (req, reply) => {
  const user = await getUserFromRequest(req)
  if (!user) return reply.status(401).send({ error: 'Unauthorized' })
  if (user.is_pro) return reply.status(409).send({ error: 'Already a Pro member' })

  const id = makeSessionId()
  await pool.query(
    `INSERT INTO billing_sessions (id, user_id, amount_cents) VALUES ($1, $2, $3)`,
    [id, user.id, PRO_PRICE_CENTS],
  )
  return {
    sessionId: id,
    amountCents: PRO_PRICE_CENTS,
    // Frontend renders this in its own "fake Stripe" page.
    checkoutPath: `/billing/checkout?session=${id}`,
  }
})

app.post<{ Body: { sessionId?: string } }>('/api/billing/confirm', async (req, reply) => {
  const user = await getUserFromRequest(req)
  if (!user) return reply.status(401).send({ error: 'Unauthorized' })
  const sessionId = req.body?.sessionId
  if (!sessionId || typeof sessionId !== 'string') {
    return reply.status(400).send({ error: 'sessionId required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const s = await client.query<{ status: string; user_id: string }>(
      `SELECT status, user_id::text FROM billing_sessions WHERE id = $1 FOR UPDATE`,
      [sessionId],
    )
    const row = s.rows[0]
    if (!row) {
      await client.query('ROLLBACK')
      return reply.status(404).send({ error: 'Session not found' })
    }
    if (row.user_id !== user.id) {
      await client.query('ROLLBACK')
      return reply.status(403).send({ error: 'Session belongs to another user' })
    }
    if (row.status === 'confirmed') {
      await client.query('COMMIT')
      return { ok: true, alreadyConfirmed: true }
    }

    await client.query(
      `UPDATE billing_sessions SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1`,
      [sessionId],
    )
    await client.query(
      `UPDATE users SET is_pro = TRUE, pro_since = COALESCE(pro_since, NOW()) WHERE id = $1`,
      [user.id],
    )

    // Auto-grant the bundled Pro themes so the unlock is visible immediately.
    await client.query(
      `INSERT INTO user_themes (user_id, theme_id)
       SELECT $1, t.id FROM themes t WHERE t.pro_only = TRUE
       ON CONFLICT DO NOTHING`,
      [user.id],
    )
    await client.query(
      `INSERT INTO user_profile_flairs (user_id, profile_flair_id)
       SELECT $1, p.id FROM profile_flairs p WHERE p.pro_only = TRUE
       ON CONFLICT DO NOTHING`,
      [user.id],
    )

    await client.query('COMMIT')
    return { ok: true }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
})

await registerGameRoutes(app)
await registerDailyRoutes(app)
await registerMarketRoutes(app)
await registerMatchRoutes(app)

const port = Number(process.env.PORT ?? 3001)

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`API listening on ${port}, CORS ${clientOrigin()}`)
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
