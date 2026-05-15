import { randomInt } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { PoolClient } from 'pg'
import { z } from 'zod'
import { pool } from '../db.js'
import { getUserFromRequest } from '../shared.js'

type DifficultyPresetRow = {
  id: number
  slug: string
  rows: number
  cols: number
  mines: number
}

type MatchStatus = 'waiting' | 'ready' | 'playing' | 'finished' | 'cancelled'
type MatchPlayerStatus = 'joined' | 'ready' | 'playing' | 'won' | 'lost' | 'draw' | 'left'
type MatchEventType =
  | 'match:create'
  | 'match:join'
  | 'match:ready'
  | 'match:start'
  | 'match:progress'
  | 'match:finish'
  | 'match:leave'
  | 'match:error'

type SocketLike = {
  OPEN: number
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  on(event: 'message', listener: (raw: Buffer | string) => void | Promise<void>): void
  on(event: 'close', listener: () => void): void
  userId?: string
}

type MatchRow = {
  id: string
  code: string
  status: MatchStatus
  seed: string
  winner_user_id: string | null
  created_at: Date
  started_at: Date | null
  ended_at: Date | null
  preset_slug: string | null
  rows: number
  cols: number
  mines: number
}

type MatchPlayerRow = {
  user_id: string
  email: string
  display_name: string | null
  side: 'host' | 'guest'
  status: MatchPlayerStatus
  score: number
  duration_ms: number
  revealed_safe_count: number
  flags_placed: number
  game_id: string | null
  joined_at: Date
  updated_at: Date
}

type MatchSnapshot = {
  id: string
  code: string
  status: MatchStatus
  seed: number
  winnerUserId: string | null
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  difficulty: {
    presetSlug: string | null
    rows: number
    cols: number
    mines: number
  }
  players: Array<{
    userId: string
    email: string
    displayName: string | null
    side: 'host' | 'guest'
    status: MatchPlayerStatus
    score: number
    durationMs: number
    revealedSafeCount: number
    flagsPlaced: number
    gameId: string | null
    joinedAt: string
    updatedAt: string
  }>
  viewerUserId: string
}

type FinishBody = {
  status?: string
  durationMs?: number
  score?: number
  moves?: unknown
  seed?: number
  rows?: number
  cols?: number
  mines?: number
  startedAt?: string
  endedAt?: string
  revealedSafeCount?: number
  flagsPlaced?: number
}

const MATCH_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MATCH_CODE_LENGTH = 6
const MAX_DIM = 40
const MIN_DIM = 5
const MAX_DURATION_MS = 24 * 60 * 60 * 1000

const MoveSchema = z
  .object({
    a: z.enum(['r', 'f', 'c']),
    r: z.number().int().nonnegative(),
    c: z.number().int().nonnegative(),
    t: z.number().int().nonnegative(),
  })
  .strict()

const CreateMatchSchema = z.object({
  presetSlug: z.string().trim().min(1),
})

const JoinMatchSchema = z.object({
  code: z.string().trim().min(1),
})

const ReadyMessageSchema = z.object({
  type: z.literal('match:ready'),
  ready: z.boolean(),
})

const ProgressMessageSchema = z.object({
  type: z.literal('match:progress'),
  score: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  revealedSafeCount: z.number().int().nonnegative(),
  flagsPlaced: z.number().int().nonnegative(),
  status: z.enum(['ready', 'playing', 'won', 'lost']).optional(),
})

const LeaveMessageSchema = z.object({
  type: z.literal('match:leave'),
})

const SocketMessageSchema = z.union([ReadyMessageSchema, ProgressMessageSchema, LeaveMessageSchema])

const roomSockets = new Map<string, Set<SocketLike>>()

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n)
}

function normalizeCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

function isSocketOpen(socket: SocketLike): boolean {
  return socket.readyState === socket.OPEN
}

function sendSocketEvent(socket: SocketLike, type: MatchEventType, payload: unknown) {
  if (!isSocketOpen(socket)) return
  socket.send(JSON.stringify({ type, payload }))
}

function attachSocket(matchId: string, socket: SocketLike) {
  const room = roomSockets.get(matchId)
  if (room) room.add(socket)
  else roomSockets.set(matchId, new Set([socket]))
}

function detachSocket(matchId: string, socket: SocketLike) {
  const room = roomSockets.get(matchId)
  if (!room) return
  room.delete(socket)
  if (room.size === 0) roomSockets.delete(matchId)
}

async function getDifficultyPreset(client: PoolClient, presetSlug: string): Promise<DifficultyPresetRow | null> {
  const r = await client.query<DifficultyPresetRow>(
    `SELECT id, slug, rows, cols, mines FROM difficulty_presets WHERE slug = $1`,
    [presetSlug],
  )
  return r.rows[0] ?? null
}

async function createUniqueCode(client: PoolClient): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    let code = ''
    for (let i = 0; i < MATCH_CODE_LENGTH; i++) {
      code += MATCH_CODE_ALPHABET[randomInt(0, MATCH_CODE_ALPHABET.length)]!
    }
    const exists = await client.query<{ id: string }>(`SELECT id FROM matches WHERE code = $1`, [code])
    if (!exists.rows[0]) return code
  }
  throw new Error('Could not allocate match code')
}

async function getParticipantRows(
  client: PoolClient,
  matchId: string,
): Promise<Array<Pick<MatchPlayerRow, 'user_id' | 'side' | 'status' | 'score' | 'duration_ms' | 'revealed_safe_count' | 'flags_placed' | 'game_id'>>> {
  const r = await client.query<
    Pick<
      MatchPlayerRow,
      'user_id' | 'side' | 'status' | 'score' | 'duration_ms' | 'revealed_safe_count' | 'flags_placed' | 'game_id'
    >
  >(
    `SELECT user_id, side, status, score, duration_ms, revealed_safe_count, flags_placed, game_id
     FROM match_players
     WHERE match_id = $1
     ORDER BY side ASC`,
    [matchId],
  )
  return r.rows
}

async function loadMatchSnapshot(matchId: string, viewerUserId: string): Promise<MatchSnapshot | null> {
  const matchRes = await pool.query<MatchRow>(
    `SELECT m.id, m.code, m.status, m.seed, m.winner_user_id, m.created_at, m.started_at, m.ended_at,
            d.slug AS preset_slug, m.rows, m.cols, m.mines
     FROM matches m
     LEFT JOIN difficulty_presets d ON d.id = m.preset_id
     WHERE m.id = $1`,
    [matchId],
  )
  const match = matchRes.rows[0]
  if (!match) return null

  const playerRes = await pool.query<MatchPlayerRow>(
    `SELECT mp.user_id, u.email, u.display_name, mp.side, mp.status, mp.score, mp.duration_ms,
            mp.revealed_safe_count, mp.flags_placed, mp.game_id::text, mp.joined_at, mp.updated_at
     FROM match_players mp
     JOIN users u ON u.id = mp.user_id
     WHERE mp.match_id = $1
     ORDER BY CASE mp.side WHEN 'host' THEN 0 ELSE 1 END, mp.joined_at ASC`,
    [matchId],
  )

  return {
    id: match.id,
    code: match.code,
    status: match.status,
    seed: Number(match.seed),
    winnerUserId: match.winner_user_id,
    createdAt: match.created_at.toISOString(),
    startedAt: match.started_at?.toISOString() ?? null,
    endedAt: match.ended_at?.toISOString() ?? null,
    difficulty: {
      presetSlug: match.preset_slug,
      rows: match.rows,
      cols: match.cols,
      mines: match.mines,
    },
    players: playerRes.rows.map((player) => ({
      userId: player.user_id,
      email: player.email,
      displayName: player.display_name,
      side: player.side,
      status: player.status,
      score: player.score,
      durationMs: player.duration_ms,
      revealedSafeCount: player.revealed_safe_count,
      flagsPlaced: player.flags_placed,
      gameId: player.game_id,
      joinedAt: player.joined_at.toISOString(),
      updatedAt: player.updated_at.toISOString(),
    })),
    viewerUserId,
  }
}

async function broadcastSnapshot(matchId: string, type: MatchEventType, viewerIds: string[]) {
  const room = roomSockets.get(matchId)
  if (!room || room.size === 0) return

  const snapshotByViewer = new Map<string, MatchSnapshot | null>()
  for (const viewerId of viewerIds) {
    if (!snapshotByViewer.has(viewerId)) {
      snapshotByViewer.set(viewerId, await loadMatchSnapshot(matchId, viewerId))
    }
  }

  const sockets = Array.from(room)
  for (const socket of sockets) {
    const viewerId = socket.userId
    if (!viewerId) continue
    const snapshot = snapshotByViewer.get(viewerId)
    if (!snapshot) continue
    sendSocketEvent(socket, type, snapshot)
  }
}

function resolveTerminalStatus(
  match: Pick<MatchRow, 'winner_user_id'>,
  playerUserId: string,
  currentStatus: MatchPlayerStatus,
): MatchPlayerStatus {
  if (currentStatus === 'left') return currentStatus
  if (!match.winner_user_id) return 'draw'
  return match.winner_user_id === playerUserId ? 'won' : 'lost'
}

async function insertFinishedGame(
  client: PoolClient,
  args: {
    userId: string
    matchId: string
    presetId: number | null
    rows: number
    cols: number
    mines: number
    seed: number
    status: 'won' | 'lost' | 'abandoned'
    durationMs: number
    score: number
    moves: Array<{ a: 'r' | 'f' | 'c'; r: number; c: number; t: number }>
    startedAt: string
    endedAt: string
  },
): Promise<string> {
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO games
     (user_id, preset_id, rows, cols, mines, seed, status, duration_ms, score, moves, match_id, started_at, ended_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      args.userId,
      args.presetId,
      args.rows,
      args.cols,
      args.mines,
      args.seed,
      args.status,
      args.durationMs,
      args.score,
      JSON.stringify(args.moves),
      args.matchId,
      args.startedAt,
      args.endedAt,
    ],
  )
  return inserted.rows[0]!.id
}

export async function registerMatchRoutes(app: FastifyInstance) {
  app.post<{ Body: { presetSlug?: string } }>('/api/matches', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const parsed = CreateMatchSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'presetSlug required' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const preset = await getDifficultyPreset(client, parsed.data.presetSlug)
      if (!preset) {
        await client.query('ROLLBACK')
        return reply.status(400).send({ error: 'Unknown difficulty preset' })
      }

      const code = await createUniqueCode(client)
      const seed = randomInt(1, 2_147_483_647)

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO matches (code, preset_id, rows, cols, mines, seed, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'waiting')
         RETURNING id`,
        [code, preset.id, preset.rows, preset.cols, preset.mines, seed],
      )
      const matchId = inserted.rows[0]!.id

      await client.query(
        `INSERT INTO match_players (match_id, user_id, side, status)
         VALUES ($1, $2, 'host', 'joined')`,
        [matchId, user.id],
      )

      await client.query('COMMIT')
      const snapshot = await loadMatchSnapshot(matchId, user.id)
      if (!snapshot) return reply.status(500).send({ error: 'Failed to load match' })
      return snapshot
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  app.post<{ Body: { code?: string } }>('/api/matches/join', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const parsed = JoinMatchSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Room code required' })
    const code = normalizeCode(parsed.data.code)
    if (code.length !== MATCH_CODE_LENGTH) {
      return reply.status(400).send({ error: 'Invalid room code' })
    }

    const client = await pool.connect()
    let matchId: string | null = null
    let viewerIds: string[] = []
    try {
      await client.query('BEGIN')
      const matchRes = await client.query<Pick<MatchRow, 'id' | 'status'>>(
        `SELECT id, status FROM matches WHERE code = $1 FOR UPDATE`,
        [code],
      )
      const match = matchRes.rows[0]
      if (!match) {
        await client.query('ROLLBACK')
        return reply.status(404).send({ error: 'Match not found' })
      }
      if (match.status === 'finished' || match.status === 'cancelled') {
        await client.query('ROLLBACK')
        return reply.status(409).send({ error: 'Match is no longer joinable' })
      }

      matchId = match.id
      const players = await getParticipantRows(client, match.id)
      const existing = players.find((player) => player.user_id === user.id)
      if (existing) {
        if (existing.status === 'left') {
          await client.query(
            `UPDATE match_players SET status = 'joined', updated_at = NOW() WHERE match_id = $1 AND user_id = $2`,
            [match.id, user.id],
          )
        }
      } else {
        if (players.length >= 2) {
          await client.query('ROLLBACK')
          return reply.status(409).send({ error: 'Room is full' })
        }
        await client.query(
          `INSERT INTO match_players (match_id, user_id, side, status)
           VALUES ($1, $2, 'guest', 'joined')`,
          [match.id, user.id],
        )
      }

      const refreshedPlayers = await getParticipantRows(client, match.id)
      const nextStatus: MatchStatus =
        refreshedPlayers.length >= 2 ? 'ready' : 'waiting'
      await client.query(`UPDATE matches SET status = $2 WHERE id = $1`, [match.id, nextStatus])

      viewerIds = refreshedPlayers.map((player) => player.user_id)
      await client.query('COMMIT')

      const snapshot = await loadMatchSnapshot(match.id, user.id)
      if (!snapshot) return reply.status(500).send({ error: 'Failed to load match' })
      await broadcastSnapshot(match.id, 'match:join', viewerIds)
      return snapshot
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  app.get<{ Params: { id: string } }>('/api/matches/:id', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })
    if (!/^\d+$/.test(req.params.id)) return reply.status(400).send({ error: 'Invalid id' })

    const snapshot = await loadMatchSnapshot(req.params.id, user.id)
    if (!snapshot) return reply.status(404).send({ error: 'Not found' })
    if (!snapshot.players.some((player) => player.userId === user.id)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    return snapshot
  })

  app.post<{ Params: { id: string }; Body: FinishBody }>('/api/matches/:id/finish', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })
    if (!/^\d+$/.test(req.params.id)) return reply.status(400).send({ error: 'Invalid id' })

    const body = req.body ?? {}
    const { status, durationMs, score, moves, seed, rows, cols, mines, startedAt, endedAt, revealedSafeCount, flagsPlaced } =
      body

    if (status !== 'won' && status !== 'lost' && status !== 'abandoned') {
      return reply.status(400).send({ error: 'Invalid status' })
    }
    if (!isInt(durationMs) || durationMs < 0 || durationMs > MAX_DURATION_MS) {
      return reply.status(400).send({ error: 'Invalid durationMs' })
    }
    if (!isInt(score) || score < 0) return reply.status(400).send({ error: 'Invalid score' })
    if (!isInt(seed)) return reply.status(400).send({ error: 'Invalid seed' })
    if (!isInt(rows) || rows < MIN_DIM || rows > MAX_DIM) {
      return reply.status(400).send({ error: 'Invalid rows' })
    }
    if (!isInt(cols) || cols < MIN_DIM || cols > MAX_DIM) {
      return reply.status(400).send({ error: 'Invalid cols' })
    }
    if (!isInt(mines) || mines < 1 || mines >= rows * cols) {
      return reply.status(400).send({ error: 'Invalid mines' })
    }
    if (!isInt(revealedSafeCount) || revealedSafeCount < 0) {
      return reply.status(400).send({ error: 'Invalid revealedSafeCount' })
    }
    if (!isInt(flagsPlaced) || flagsPlaced < 0) {
      return reply.status(400).send({ error: 'Invalid flagsPlaced' })
    }

    const movesResult = z.array(MoveSchema).max(rows * cols * 4).safeParse(moves)
    if (!movesResult.success) return reply.status(400).send({ error: 'Invalid moves' })
    const validatedMoves = movesResult.data
    if (validatedMoves.some((move) => move.r >= rows || move.c >= cols)) {
      return reply.status(400).send({ error: 'Move outside board' })
    }

    const client = await pool.connect()
    let matchId = req.params.id
    let viewerIds: string[] = []
    try {
      await client.query('BEGIN')

      const matchRes = await client.query<
        Pick<MatchRow, 'id' | 'status' | 'seed' | 'rows' | 'cols' | 'mines' | 'winner_user_id'> & {
          preset_id: number | null
          preset_slug: string | null
          started_at: Date | null
        }
      >(
        `SELECT m.id, m.status, m.seed, m.rows, m.cols, m.mines, m.preset_id, m.winner_user_id, m.started_at,
                d.slug AS preset_slug
         FROM matches m
         LEFT JOIN difficulty_presets d ON d.id = m.preset_id
         WHERE m.id = $1
         FOR UPDATE`,
        [matchId],
      )
      const match = matchRes.rows[0]
      if (!match) {
        await client.query('ROLLBACK')
        return reply.status(404).send({ error: 'Match not found' })
      }

      const players = await getParticipantRows(client, matchId)
      const player = players.find((row) => row.user_id === user.id)
      if (!player) {
        await client.query('ROLLBACK')
        return reply.status(403).send({ error: 'Forbidden' })
      }

      if (Number(match.seed) !== seed || match.rows !== rows || match.cols !== cols || match.mines !== mines) {
        await client.query('ROLLBACK')
        return reply.status(400).send({ error: 'Match settings mismatch' })
      }

      if (player.game_id) {
        await client.query('COMMIT')
        const snapshot = await loadMatchSnapshot(matchId, user.id)
        if (!snapshot) return reply.status(404).send({ error: 'Match not found' })
        return { gameId: player.game_id, match: snapshot }
      }

      const now = new Date()
      const endedAtDate = endedAt ? new Date(endedAt) : now
      const startedAtDate = startedAt
        ? new Date(startedAt)
        : new Date(endedAtDate.getTime() - durationMs)

      const gameId = await insertFinishedGame(client, {
        userId: user.id,
        matchId,
        presetId: match.preset_id,
        rows,
        cols,
        mines,
        seed,
        status,
        durationMs,
        score,
        moves: validatedMoves,
        startedAt: startedAtDate.toISOString(),
        endedAt: endedAtDate.toISOString(),
      })

      const nextPlayerStatus: MatchPlayerStatus =
        match.status === 'finished'
          ? resolveTerminalStatus(match, user.id, player.status)
          : status === 'won'
            ? 'won'
            : status === 'lost'
              ? 'lost'
              : 'left'

      await client.query(
        `UPDATE match_players
         SET status = $3,
             score = $4,
             duration_ms = $5,
             revealed_safe_count = $6,
             flags_placed = $7,
             game_id = $8,
             updated_at = NOW()
         WHERE match_id = $1 AND user_id = $2`,
        [matchId, user.id, nextPlayerStatus, score, durationMs, revealedSafeCount, flagsPlaced, gameId],
      )

      const afterSubmit = await getParticipantRows(client, matchId)
      const opponent = afterSubmit.find((row) => row.user_id !== user.id)
      const isSpeed = match.preset_slug === 'speed'
      let finishWinnerUserId: string | null | undefined
      let shouldFinish = false

      if (match.status !== 'finished' && match.status !== 'cancelled') {
        if (isSpeed) {
          const everyoneDone =
            afterSubmit.length === 2 && afterSubmit.every((row) => row.game_id || row.status === 'left')
          if (everyoneDone) {
            shouldFinish = true
            const [host, guest] = afterSubmit
            if (!host || !guest) finishWinnerUserId = null
            else if (host.status === 'left' && guest.status !== 'left') finishWinnerUserId = guest.user_id
            else if (guest.status === 'left' && host.status !== 'left') finishWinnerUserId = host.user_id
            else if (host.score > guest.score) finishWinnerUserId = host.user_id
            else if (guest.score > host.score) finishWinnerUserId = guest.user_id
            else finishWinnerUserId = null
          }
        } else if (status === 'won') {
          shouldFinish = true
          finishWinnerUserId = user.id
        } else if (status === 'lost' || status === 'abandoned') {
          shouldFinish = true
          finishWinnerUserId = opponent?.user_id ?? null
        }
      }

      if (shouldFinish) {
        await client.query(
          `UPDATE matches
           SET status = 'finished',
               winner_user_id = $2,
               started_at = COALESCE(started_at, NOW()),
               ended_at = NOW()
           WHERE id = $1`,
          [matchId, finishWinnerUserId ?? null],
        )

        if (finishWinnerUserId) {
          await client.query(
            `UPDATE match_players
             SET status = CASE
               WHEN user_id = $2 THEN 'won'
               WHEN status = 'left' THEN 'left'
               ELSE 'lost'
             END,
             updated_at = NOW()
             WHERE match_id = $1`,
            [matchId, finishWinnerUserId],
          )
        } else {
          await client.query(
            `UPDATE match_players
             SET status = CASE WHEN status = 'left' THEN 'left' ELSE 'draw' END,
                 updated_at = NOW()
             WHERE match_id = $1`,
            [matchId],
          )
        }
      } else if (match.status === 'playing' && !match.started_at) {
        await client.query(`UPDATE matches SET started_at = NOW() WHERE id = $1`, [matchId])
      }

      const finalPlayers = await getParticipantRows(client, matchId)
      viewerIds = finalPlayers.map((row) => row.user_id)
      await client.query('COMMIT')

      const snapshot = await loadMatchSnapshot(matchId, user.id)
      if (!snapshot) return reply.status(404).send({ error: 'Match not found' })
      await broadcastSnapshot(matchId, shouldFinish ? 'match:finish' : 'match:progress', viewerIds)
      return { gameId, match: snapshot }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  app.get<{ Params: { id: string } }>(
    '/api/matches/:id/live',
    { websocket: true },
    async (socket, request) => {
      const user = await getUserFromRequest(request)
      if (!user) {
        socket.close(4401, 'Unauthorized')
        return
      }
      if (!/^\d+$/.test(request.params.id)) {
        socket.close(4400, 'Invalid id')
        return
      }

      const snapshot = await loadMatchSnapshot(request.params.id, user.id)
      if (!snapshot || !snapshot.players.some((player) => player.userId === user.id)) {
        socket.close(4403, 'Forbidden')
        return
      }

      const liveSocket = socket as unknown as SocketLike
      liveSocket.userId = user.id
      attachSocket(request.params.id, liveSocket)
      sendSocketEvent(liveSocket, 'match:join', snapshot)

      liveSocket.on('message', async (raw: Buffer | string) => {
        const text = typeof raw === 'string' ? raw : raw.toString()
        let payload: unknown
        try {
          payload = JSON.parse(text)
        } catch {
          sendSocketEvent(liveSocket, 'match:error', { message: 'Invalid JSON payload' })
          return
        }

        const parsed = SocketMessageSchema.safeParse(payload)
        if (!parsed.success) {
          sendSocketEvent(liveSocket, 'match:error', { message: 'Invalid event payload' })
          return
        }

        if (parsed.data.type === 'match:ready') {
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            const matchRes = await client.query<Pick<MatchRow, 'status'>>(
              `SELECT status FROM matches WHERE id = $1 FOR UPDATE`,
              [request.params.id],
            )
            const match = matchRes.rows[0]
            if (!match) {
              await client.query('ROLLBACK')
              sendSocketEvent(liveSocket, 'match:error', { message: 'Match not found' })
              return
            }
            if (match.status === 'playing' || match.status === 'finished' || match.status === 'cancelled') {
              await client.query('ROLLBACK')
              return
            }

            await client.query(
              `UPDATE match_players
               SET status = $3, updated_at = NOW()
               WHERE match_id = $1 AND user_id = $2`,
              [request.params.id, user.id, parsed.data.ready ? 'ready' : 'joined'],
            )

            const players = await getParticipantRows(client, request.params.id)
            const allReady = players.length === 2 && players.every((player) => player.status === 'ready')
            const nextStatus: MatchStatus = allReady ? 'playing' : players.length === 2 ? 'ready' : 'waiting'
            await client.query(
              `UPDATE matches
               SET status = $2,
                   started_at = CASE WHEN $2 = 'playing' THEN COALESCE(started_at, NOW()) ELSE started_at END
               WHERE id = $1`,
              [request.params.id, nextStatus],
            )

            const viewerIds = players.map((player) => player.user_id)
            if (allReady) {
              await client.query(
                `UPDATE match_players
                 SET status = 'playing', updated_at = NOW()
                 WHERE match_id = $1`,
                [request.params.id],
              )
            }

            await client.query('COMMIT')
            await broadcastSnapshot(
              request.params.id,
              allReady ? 'match:start' : 'match:ready',
              viewerIds,
            )
          } catch (error) {
            await client.query('ROLLBACK')
            sendSocketEvent(liveSocket, 'match:error', { message: 'Failed to update readiness' })
            throw error
          } finally {
            client.release()
          }
          return
        }

        if (parsed.data.type === 'match:progress') {
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            const matchRes = await client.query<Pick<MatchRow, 'status'>>(
              `SELECT status FROM matches WHERE id = $1 FOR UPDATE`,
              [request.params.id],
            )
            const match = matchRes.rows[0]
            if (!match || match.status !== 'playing') {
              await client.query('ROLLBACK')
              return
            }

            await client.query(
              `UPDATE match_players
               SET score = $3,
                   duration_ms = $4,
                   revealed_safe_count = $5,
                   flags_placed = $6,
                   status = CASE
                     WHEN status IN ('won', 'lost', 'draw', 'left') THEN status
                     ELSE 'playing'
                   END,
                   updated_at = NOW()
               WHERE match_id = $1 AND user_id = $2`,
              [
                request.params.id,
                user.id,
                parsed.data.score,
                parsed.data.durationMs,
                parsed.data.revealedSafeCount,
                parsed.data.flagsPlaced,
              ],
            )

            const players = await getParticipantRows(client, request.params.id)
            const viewerIds = players.map((player) => player.user_id)
            await client.query('COMMIT')
            await broadcastSnapshot(request.params.id, 'match:progress', viewerIds)
          } catch (error) {
            await client.query('ROLLBACK')
            sendSocketEvent(liveSocket, 'match:error', { message: 'Failed to update progress' })
            throw error
          } finally {
            client.release()
          }
          return
        }

        if (parsed.data.type === 'match:leave') {
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            const matchRes = await client.query<Pick<MatchRow, 'status'>>(
              `SELECT status FROM matches WHERE id = $1 FOR UPDATE`,
              [request.params.id],
            )
            const match = matchRes.rows[0]
            if (!match || match.status === 'finished' || match.status === 'cancelled') {
              await client.query('ROLLBACK')
              return
            }

            const players = await getParticipantRows(client, request.params.id)
            const opponent = players.find((player) => player.user_id !== user.id)

            await client.query(
              `UPDATE match_players
               SET status = 'left', updated_at = NOW()
               WHERE match_id = $1 AND user_id = $2`,
              [request.params.id, user.id],
            )

            if (match.status === 'playing' && opponent) {
              await client.query(
                `UPDATE matches
                 SET status = 'finished', winner_user_id = $2, ended_at = NOW()
                 WHERE id = $1`,
                [request.params.id, opponent.user_id],
              )
              await client.query(
                `UPDATE match_players
                 SET status = CASE
                   WHEN user_id = $2 THEN 'won'
                   WHEN user_id = $3 THEN 'left'
                   ELSE status
                 END,
                 updated_at = NOW()
                 WHERE match_id = $1`,
                [request.params.id, opponent.user_id, user.id],
              )
            } else {
              await client.query(
                `UPDATE matches
                 SET status = 'cancelled', ended_at = NOW()
                 WHERE id = $1`,
                [request.params.id],
              )
            }

            const finalPlayers = await getParticipantRows(client, request.params.id)
            const viewerIds = finalPlayers.map((player) => player.user_id)
            await client.query('COMMIT')
            await broadcastSnapshot(request.params.id, 'match:leave', viewerIds)
            await broadcastSnapshot(
              request.params.id,
              match.status === 'playing' ? 'match:finish' : 'match:leave',
              viewerIds,
            )
          } catch (error) {
            await client.query('ROLLBACK')
            sendSocketEvent(liveSocket, 'match:error', { message: 'Failed to leave match' })
            throw error
          } finally {
            client.release()
          }
        }
      })

      liveSocket.on('close', () => {
        detachSocket(request.params.id, liveSocket)
      })
    },
  )
}
