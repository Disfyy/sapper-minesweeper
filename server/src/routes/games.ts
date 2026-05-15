import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { pool } from '../db.js'
import {
  getUserFromRequest,
  normalizeCity,
  WIN_COINS,
  WIN_DAILY_CAP,
  WIN_MIN_INTERVAL_MS,
  WIN_PER_MINUTE_MAX,
} from '../shared.js'

type SubmitBody = {
  status?: string
  durationMs?: number
  score?: number
  moves?: unknown
  seed?: number
  rows?: number
  cols?: number
  mines?: number
  presetSlug?: string
  startedAt?: string
  endedAt?: string
}

type DifficultyPresetRow = {
  id: number
  slug: string
  rows: number
  cols: number
  mines: number
}

type LeaderboardDifficulty = 'beginner' | 'intermediate' | 'expert' | 'speed'

const MAX_DIM = 40
const MIN_DIM = 5
const MAX_DURATION_MS = 24 * 60 * 60 * 1000
const LEADERBOARD_DIFFICULTIES = new Set<LeaderboardDifficulty>([
  'beginner',
  'intermediate',
  'expert',
  'speed',
])

const MoveSchema = z
  .object({
    a: z.enum(['r', 'f', 'c']),
    r: z.number().int().nonnegative(),
    c: z.number().int().nonnegative(),
    t: z.number().int().nonnegative(),
  })
  .strict()

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n)
}

function isLeaderboardDifficulty(value: unknown): value is LeaderboardDifficulty {
  return typeof value === 'string' && LEADERBOARD_DIFFICULTIES.has(value as LeaderboardDifficulty)
}

function bestTimeUpsertSql(presetSlug: string | undefined): string | null {
  switch (presetSlug) {
    case 'beginner':
      return `INSERT INTO user_stats (user_id, games_played, wins, best_time_beginner_ms, updated_at)
              VALUES ($1, 1, 1, $2, NOW())
              ON CONFLICT (user_id) DO UPDATE SET
                games_played = user_stats.games_played + 1,
                wins = user_stats.wins + 1,
                best_time_beginner_ms = LEAST(COALESCE(user_stats.best_time_beginner_ms, $2), $2),
                updated_at = NOW()`
    case 'intermediate':
      return `INSERT INTO user_stats (user_id, games_played, wins, best_time_intermediate_ms, updated_at)
              VALUES ($1, 1, 1, $2, NOW())
              ON CONFLICT (user_id) DO UPDATE SET
                games_played = user_stats.games_played + 1,
                wins = user_stats.wins + 1,
                best_time_intermediate_ms = LEAST(COALESCE(user_stats.best_time_intermediate_ms, $2), $2),
                updated_at = NOW()`
    case 'expert':
      return `INSERT INTO user_stats (user_id, games_played, wins, best_time_expert_ms, updated_at)
              VALUES ($1, 1, 1, $2, NOW())
              ON CONFLICT (user_id) DO UPDATE SET
                games_played = user_stats.games_played + 1,
                wins = user_stats.wins + 1,
                best_time_expert_ms = LEAST(COALESCE(user_stats.best_time_expert_ms, $2), $2),
                updated_at = NOW()`
    default:
      return null
  }
}

export async function registerGameRoutes(app: FastifyInstance) {
  app.get('/api/difficulties', async () => {
    const r = await pool.query<DifficultyPresetRow>(
      `SELECT id, slug, rows, cols, mines FROM difficulty_presets ORDER BY id`,
    )
    return { presets: r.rows }
  })

  app.get<{ Querystring: { difficulty?: string; city?: string } }>(
    '/api/leaderboard',
    async (req, reply) => {
      const difficulty = req.query.difficulty
      if (!isLeaderboardDifficulty(difficulty)) {
        return reply.status(400).send({ error: 'Invalid difficulty' })
      }
      const city = normalizeCity(req.query.city)
      const cityClause = city ? ' AND u.city = $2' : ''
      const args: unknown[] = city ? [difficulty, city] : [difficulty]

      // Speed mode ranks by highest score (cells cleared + time-left bonus).
      // Regular modes rank by fastest completion (lowest duration_ms).
      // Speed counts any finished game (status != 'abandoned') so timeouts still appear;
      // regular modes only count wins.
      if (difficulty === 'speed') {
        const r = await pool.query<{
          username: string | null
          display_name: string | null
          city: string | null
          best_score: number
          best_ms: number | null
          games_played: number
        }>(
          `SELECT
             u.username,
             u.display_name,
             u.city,
             MAX(g.score)::int AS best_score,
             MIN(g.duration_ms) FILTER (WHERE g.status = 'won')::int AS best_ms,
             COUNT(*)::int AS games_played
           FROM games g
           JOIN users u ON u.id = g.user_id
           JOIN difficulty_presets d ON d.id = g.preset_id
           WHERE g.status <> 'abandoned' AND d.slug = $1${cityClause}
           GROUP BY u.id
           ORDER BY best_score DESC
           LIMIT 10`,
          args,
        )

        return {
          items: r.rows.map((row, index) => ({
            rank: index + 1,
            username: row.username,
            displayName: row.display_name,
            city: row.city,
            bestScore: row.best_score,
            bestMs: row.best_ms,
            gamesPlayed: row.games_played,
          })),
        }
      }

      const r = await pool.query<{
        username: string | null
        display_name: string | null
        city: string | null
        best_ms: number
        games_played: number
      }>(
        `SELECT
           u.username,
           u.display_name,
           u.city,
           MIN(g.duration_ms)::int AS best_ms,
           COUNT(*)::int AS games_played
         FROM games g
         JOIN users u ON u.id = g.user_id
         JOIN difficulty_presets d ON d.id = g.preset_id
         WHERE g.status = 'won' AND d.slug = $1${cityClause}
         GROUP BY u.id
         ORDER BY best_ms ASC
         LIMIT 10`,
        args,
      )

      return {
        items: r.rows.map((row, index) => ({
          rank: index + 1,
          username: row.username,
          displayName: row.display_name,
          city: row.city,
          bestMs: row.best_ms,
          gamesPlayed: row.games_played,
        })),
      }
    },
  )

  app.post<{ Body: SubmitBody }>('/api/games', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const body = req.body ?? {}
    const { status, durationMs, score, moves, seed, rows, cols, mines, presetSlug, startedAt, endedAt } = body

    if (status !== 'won' && status !== 'lost' && status !== 'abandoned') {
      return reply.status(400).send({ error: 'Invalid status' })
    }
    if (!isInt(durationMs) || durationMs! < 0 || durationMs! > MAX_DURATION_MS) {
      return reply.status(400).send({ error: 'Invalid durationMs' })
    }
    if (!isInt(score) || score! < 0) {
      return reply.status(400).send({ error: 'Invalid score' })
    }
    if (!isInt(seed)) {
      return reply.status(400).send({ error: 'Invalid seed' })
    }
    if (!isInt(rows) || rows! < MIN_DIM || rows! > MAX_DIM) {
      return reply.status(400).send({ error: 'Invalid rows' })
    }
    if (!isInt(cols) || cols! < MIN_DIM || cols! > MAX_DIM) {
      return reply.status(400).send({ error: 'Invalid cols' })
    }
    if (!isInt(mines) || mines! < 1 || mines! >= rows! * cols!) {
      return reply.status(400).send({ error: 'Invalid mines' })
    }
    const movesResult = z.array(MoveSchema).max(rows! * cols! * 4).safeParse(moves)
    if (!movesResult.success) {
      return reply.status(400).send({ error: 'Invalid moves' })
    }
    const validatedMoves = movesResult.data
    if (validatedMoves.some((move) => move.r >= rows! || move.c >= cols!)) {
      return reply.status(400).send({ error: 'Move outside board' })
    }

    let presetId: number | null = null
    if (presetSlug) {
      const p = await pool.query<DifficultyPresetRow>(
        `SELECT id, rows, cols, mines FROM difficulty_presets WHERE slug = $1`,
        [presetSlug],
      )
      const row = p.rows[0]
      if (!row || row.rows !== rows || row.cols !== cols || row.mines !== mines) {
        return reply.status(400).send({ error: 'Preset/dimensions mismatch' })
      }
      presetId = row.id
    }

    const now = new Date()
    const endedAtDate = endedAt ? new Date(endedAt) : now
    const startedAtDate = startedAt
      ? new Date(startedAt)
      : new Date(endedAtDate.getTime() - durationMs!)

    // Win-reward eligibility (same caps as legacy /api/rewards/win).
    let grantedCoins = 0
    if (status === 'won') {
      const startOfDay = new Date(now)
      startOfDay.setUTCHours(0, 0, 0, 0)
      const daily = await pool.query<{ sum: string }>(
        `SELECT COALESCE(SUM(coins_granted), 0)::text AS sum FROM win_reward_log
         WHERE user_id = $1 AND created_at >= $2`,
        [user.id, startOfDay.toISOString()],
      )
      const dailyTotal = Number(daily.rows[0]?.sum ?? 0)
      if (dailyTotal < WIN_DAILY_CAP) {
        const last = await pool.query<{ created_at: Date }>(
          `SELECT created_at FROM win_reward_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [user.id],
        )
        const okInterval =
          !last.rows[0] ||
          now.getTime() - new Date(last.rows[0].created_at).getTime() >= WIN_MIN_INTERVAL_MS
        const minuteAgo = new Date(now.getTime() - 60_000)
        const recent = await pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM win_reward_log WHERE user_id = $1 AND created_at >= $2`,
          [user.id, minuteAgo.toISOString()],
        )
        const okMinute = Number(recent.rows[0]?.c ?? 0) < WIN_PER_MINUTE_MAX
        if (okInterval && okMinute) {
          grantedCoins = Math.min(WIN_COINS, WIN_DAILY_CAP - dailyTotal)
        }
      }
    }

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
          rows,
          cols,
          mines,
          seed,
          status,
          durationMs,
          score,
          JSON.stringify(validatedMoves),
          startedAtDate.toISOString(),
          endedAtDate.toISOString(),
        ],
      )
      const gameId = inserted.rows[0]!.id

      const isWin = status === 'won'
      const bestTimeSql = isWin ? bestTimeUpsertSql(presetSlug) : null

      if (bestTimeSql) {
        await client.query(bestTimeSql, [user.id, durationMs])
      } else {
        await client.query(
          `INSERT INTO user_stats (user_id, games_played, wins, updated_at)
           VALUES ($1, 1, $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             games_played = user_stats.games_played + 1,
             wins = user_stats.wins + $2,
             updated_at = NOW()`,
          [user.id, isWin ? 1 : 0],
        )
      }

      if (grantedCoins > 0) {
        try {
          await client.query(
            `INSERT INTO win_reward_log (user_id, game_id, coins_granted) VALUES ($1, $2, $3)`,
            [user.id, gameId, grantedCoins],
          )
          await client.query(`UPDATE users SET coins = coins + $1 WHERE id = $2`, [
            grantedCoins,
            user.id,
          ])
        } catch (e: unknown) {
          const err = e as { code?: string }
          if (err.code !== '23505') throw e
          grantedCoins = 0
        }
      }

      await client.query('COMMIT')

      const after = await pool.query<{ coins: number }>(
        `SELECT coins FROM users WHERE id = $1`,
        [user.id],
      )

      return { ok: true, gameId, coins: after.rows[0]?.coins ?? user.coins, grantedCoins }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  })

  app.get<{
    Querystring: {
      cursor?: string
      difficulty?: string
      outcome?: string
      from?: string
      to?: string
      limit?: string
    }
  }>('/api/games', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)))
    const cursor = req.query.cursor ? Number(req.query.cursor) : null

    const where: string[] = ['user_id = $1']
    const args: unknown[] = [user.id]

    if (cursor !== null && Number.isFinite(cursor)) {
      args.push(cursor)
      where.push(`id < $${args.length}`)
    }
    if (req.query.difficulty) {
      args.push(req.query.difficulty)
      where.push(`preset_id = (SELECT id FROM difficulty_presets WHERE slug = $${args.length})`)
    }
    if (req.query.outcome === 'won' || req.query.outcome === 'lost' || req.query.outcome === 'abandoned') {
      args.push(req.query.outcome)
      where.push(`status = $${args.length}`)
    }
    if (req.query.from) {
      args.push(new Date(req.query.from).toISOString())
      where.push(`ended_at >= $${args.length}`)
    }
    if (req.query.to) {
      args.push(new Date(req.query.to).toISOString())
      where.push(`ended_at <= $${args.length}`)
    }

    const r = await pool.query<{
      id: string
      preset_id: number | null
      preset_slug: string | null
      rows: number
      cols: number
      mines: number
      status: string
      duration_ms: number
      score: number
      ended_at: Date
    }>(
      `SELECT g.id, g.preset_id, d.slug AS preset_slug, g.rows, g.cols, g.mines, g.status,
              g.duration_ms, g.score, g.ended_at
       FROM games g
       LEFT JOIN difficulty_presets d ON d.id = g.preset_id
       WHERE ${where.join(' AND ')}
       ORDER BY g.id DESC
       LIMIT ${limit + 1}`,
      args,
    )

    const items = r.rows.slice(0, limit).map((row) => ({
      id: row.id,
      presetSlug: row.preset_slug,
      rows: row.rows,
      cols: row.cols,
      mines: row.mines,
      status: row.status,
      durationMs: row.duration_ms,
      score: row.score,
      endedAt: row.ended_at,
    }))
    const nextCursor = r.rows.length > limit ? items[items.length - 1]?.id : null

    return { items, nextCursor }
  })

  app.get<{ Params: { id: string } }>('/api/games/:id', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const gameId = req.params.id
    if (!/^\d+$/.test(gameId)) {
      return reply.status(400).send({ error: 'Invalid id' })
    }

    const r = await pool.query<{
      id: string
      user_id: string
      preset_slug: string | null
      rows: number
      cols: number
      mines: number
      seed: string
      status: string
      duration_ms: number
      score: number
      moves: unknown
      started_at: Date
      ended_at: Date
    }>(
      `SELECT g.id, g.user_id, d.slug AS preset_slug, g.rows, g.cols, g.mines, g.seed,
              g.status, g.duration_ms, g.score, g.moves, g.started_at, g.ended_at
       FROM games g
       LEFT JOIN difficulty_presets d ON d.id = g.preset_id
       WHERE g.id = $1`,
      [gameId],
    )
    const row = r.rows[0]
    if (!row) return reply.status(404).send({ error: 'Not found' })
    if (row.user_id !== user.id) return reply.status(403).send({ error: 'Forbidden' })

    return {
      id: row.id,
      presetSlug: row.preset_slug,
      rows: row.rows,
      cols: row.cols,
      mines: row.mines,
      seed: Number(row.seed),
      status: row.status,
      durationMs: row.duration_ms,
      score: row.score,
      moves: row.moves,
      startedAt: row.started_at,
      endedAt: row.ended_at,
    }
  })
}
