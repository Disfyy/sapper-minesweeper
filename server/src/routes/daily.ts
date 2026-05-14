import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { pool } from '../db.js'
import { getUserFromRequest } from '../shared.js'

const DAILY_PRESET_SLUG = 'intermediate'

/** Deterministic 32-bit seed derived from a UTC date (YYYYMMDD). */
function seedFromDate(dateUTC: Date): number {
  const y = dateUTC.getUTCFullYear()
  const m = dateUTC.getUTCMonth() + 1
  const d = dateUTC.getUTCDate()
  let s = (y * 10000 + m * 100 + d) >>> 0
  // Avalanche pass to spread sequential dates across the seed space.
  s = (s + 0x9e3779b9) >>> 0
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0
  return (s ^ (s >>> 16)) >>> 0
}

function todayUtcISODate(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

type DailyChallengeRow = {
  challenge_date: string
  seed: string
  preset_slug: string
  rows: number
  cols: number
  mines: number
}

async function getOrCreateDaily(dateISO: string): Promise<DailyChallengeRow> {
  const existing = await pool.query<DailyChallengeRow>(
    `SELECT challenge_date::text, seed::text, preset_slug, rows, cols, mines
     FROM daily_challenges WHERE challenge_date = $1`,
    [dateISO],
  )
  if (existing.rows[0]) return existing.rows[0]

  const preset = await pool.query<{ rows: number; cols: number; mines: number }>(
    `SELECT rows, cols, mines FROM difficulty_presets WHERE slug = $1`,
    [DAILY_PRESET_SLUG],
  )
  const p = preset.rows[0]
  if (!p) throw new Error('Daily preset missing in difficulty_presets')

  const seed = seedFromDate(new Date(dateISO + 'T00:00:00Z'))
  const inserted = await pool.query<DailyChallengeRow>(
    `INSERT INTO daily_challenges (challenge_date, seed, preset_slug, rows, cols, mines)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (challenge_date) DO NOTHING
     RETURNING challenge_date::text, seed::text, preset_slug, rows, cols, mines`,
    [dateISO, seed, DAILY_PRESET_SLUG, p.rows, p.cols, p.mines],
  )
  if (inserted.rows[0]) return inserted.rows[0]

  // Race: another request inserted first — re-fetch.
  const after = await pool.query<DailyChallengeRow>(
    `SELECT challenge_date::text, seed::text, preset_slug, rows, cols, mines
     FROM daily_challenges WHERE challenge_date = $1`,
    [dateISO],
  )
  return after.rows[0]!
}

const SubmitSchema = z
  .object({
    durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
    score: z.number().int().min(0),
    status: z.enum(['won', 'lost', 'abandoned']),
    moves: z.array(
      z
        .object({
          a: z.enum(['r', 'f', 'c']),
          r: z.number().int().nonnegative(),
          c: z.number().int().nonnegative(),
          t: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict()

export async function registerDailyRoutes(app: FastifyInstance) {
  // Today's challenge metadata + whether the current user has played.
  app.get('/api/daily/today', async (req, reply) => {
    const user = await getUserFromRequest(req)
    const dateISO = todayUtcISODate()
    const daily = await getOrCreateDaily(dateISO)

    let alreadyPlayed = false
    let attemptGameId: string | null = null
    if (user) {
      const r = await pool.query<{ game_id: string; status: string; duration_ms: number; score: number }>(
        `SELECT game_id::text, status, duration_ms, score
         FROM daily_attempts WHERE user_id = $1 AND challenge_date = $2`,
        [user.id, dateISO],
      )
      const row = r.rows[0]
      if (row) {
        alreadyPlayed = true
        attemptGameId = row.game_id
      }
    }

    return {
      date: daily.challenge_date,
      seed: Number(daily.seed),
      presetSlug: daily.preset_slug,
      rows: daily.rows,
      cols: daily.cols,
      mines: daily.mines,
      alreadyPlayed,
      attemptGameId,
    }
  })

  // Top scores for a given UTC date.
  app.get<{ Querystring: { date?: string } }>(
    '/api/daily/leaderboard',
    async (req, reply) => {
      const dateISO = req.query.date && isISODate(req.query.date) ? req.query.date : todayUtcISODate()

      const r = await pool.query<{
        username: string | null
        display_name: string | null
        duration_ms: number
        status: string
        score: number
      }>(
        `SELECT u.username, u.display_name, a.duration_ms, a.status, a.score
         FROM daily_attempts a
         JOIN users u ON u.id = a.user_id
         WHERE a.challenge_date = $1
         ORDER BY (a.status = 'won') DESC, a.duration_ms ASC
         LIMIT 50`,
        [dateISO],
      )

      return {
        date: dateISO,
        items: r.rows.map((row, index) => ({
          rank: index + 1,
          username: row.username,
          displayName: row.display_name,
          durationMs: row.duration_ms,
          status: row.status,
          score: row.score,
        })),
      }
    },
  )

  // Submit a daily attempt. Reuses /api/games for the game row, then writes
  // daily_attempts. One-shot per user per day.
  app.post('/api/daily/submit', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const parsed = SubmitSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid submission' })
    }
    const { durationMs, score, status, moves } = parsed.data

    const dateISO = todayUtcISODate()
    const daily = await getOrCreateDaily(dateISO)

    // Already-played guard (avoids leaving a games row behind for duplicates).
    const existing = await pool.query<{ game_id: string }>(
      `SELECT game_id::text FROM daily_attempts WHERE user_id = $1 AND challenge_date = $2`,
      [user.id, dateISO],
    )
    if (existing.rows[0]) {
      return reply.status(409).send({
        error: 'Already played today',
        attemptGameId: existing.rows[0].game_id,
      })
    }

    const preset = await pool.query<{ id: number }>(
      `SELECT id FROM difficulty_presets WHERE slug = $1`,
      [daily.preset_slug],
    )
    const presetId = preset.rows[0]?.id ?? null

    const movesOk = moves.every((m) => m.r < daily.rows && m.c < daily.cols)
    if (!movesOk) return reply.status(400).send({ error: 'Move outside board' })

    const now = new Date()
    const startedAt = new Date(now.getTime() - durationMs)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO games
           (user_id, preset_id, rows, cols, mines, seed, status, duration_ms, score, moves, started_at, ended_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          user.id,
          presetId,
          daily.rows,
          daily.cols,
          daily.mines,
          Number(daily.seed),
          status,
          durationMs,
          score,
          JSON.stringify(moves),
          startedAt.toISOString(),
          now.toISOString(),
        ],
      )
      const gameId = inserted.rows[0]!.id

      await client.query(
        `INSERT INTO daily_attempts
           (user_id, challenge_date, game_id, status, duration_ms, score)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, dateISO, gameId, status, durationMs, score],
      )

      // Bump aggregate stats so daily wins count toward profile totals.
      await client.query(
        `INSERT INTO user_stats (user_id, games_played, wins, updated_at)
         VALUES ($1, 1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           games_played = user_stats.games_played + 1,
           wins = user_stats.wins + $2,
           updated_at = NOW()`,
        [user.id, status === 'won' ? 1 : 0],
      )

      await client.query('COMMIT')
      return { ok: true, gameId, attemptGameId: gameId, date: dateISO }
    } catch (e: unknown) {
      await client.query('ROLLBACK')
      const err = e as { code?: string }
      // Daily attempts PK violation (race).
      if (err.code === '23505') {
        const refetch = await pool.query<{ game_id: string }>(
          `SELECT game_id::text FROM daily_attempts WHERE user_id = $1 AND challenge_date = $2`,
          [user.id, dateISO],
        )
        return reply.status(409).send({
          error: 'Already played today',
          attemptGameId: refetch.rows[0]?.game_id ?? null,
        })
      }
      throw e
    } finally {
      client.release()
    }
  })
}
