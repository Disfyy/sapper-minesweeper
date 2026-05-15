import type { FastifyInstance } from 'fastify'
import { pool } from '../db.js'
import { getUserFromRequest, type AuthedUser } from '../shared.js'

export type CosmeticKind = 'theme' | 'mine_skin' | 'victory_effect' | 'profile_flair'

type CatalogConfig = {
  table: string
  userTable: string
  itemIdCol: string
  equipCol: string
  proCol: string
  orderBy: string
  extraSelect: string
  mapRow: (row: Record<string, unknown>, owned: Set<number>, user: AuthedUser) => Record<string, unknown>
}

const CATALOG: Record<CosmeticKind, CatalogConfig> = {
  theme: {
    table: 'themes',
    userTable: 'user_themes',
    itemIdCol: 'theme_id',
    equipCol: 'equipped_theme_id',
    proCol: 'pro_only',
    orderBy: 'id',
    extraSelect: `slug, name, price_coins AS price_coins, pro_only`,
    mapRow: (row, owned, user) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      priceCoins: row.price_coins,
      owned: owned.has(row.id as number),
      equipped: user.equipped_theme_id === row.id,
      proOnly: row.pro_only,
    }),
  },
  mine_skin: {
    table: 'mine_skins',
    userTable: 'user_mine_skins',
    itemIdCol: 'mine_skin_id',
    equipCol: 'equipped_mine_skin_id',
    proCol: 'pro_only',
    orderBy: 'id',
    extraSelect: `slug, name, variant, price_coins AS price_coins, pro_only`,
    mapRow: (row, owned, user) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      variant: row.variant,
      priceCoins: row.price_coins,
      owned: owned.has(row.id as number),
      equipped: user.equipped_mine_skin_id === row.id,
      proOnly: row.pro_only,
    }),
  },
  victory_effect: {
    table: 'victory_effects',
    userTable: 'user_victory_effects',
    itemIdCol: 'victory_effect_id',
    equipCol: 'equipped_victory_effect_id',
    proCol: 'pro_only',
    orderBy: 'id',
    extraSelect: `slug, name, variant, price_coins AS price_coins, pro_only`,
    mapRow: (row, owned, user) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      variant: row.variant,
      priceCoins: row.price_coins,
      owned: owned.has(row.id as number),
      equipped: user.equipped_victory_effect_id === row.id,
      proOnly: row.pro_only,
    }),
  },
  profile_flair: {
    table: 'profile_flairs',
    userTable: 'user_profile_flairs',
    itemIdCol: 'profile_flair_id',
    equipCol: 'equipped_profile_flair_id',
    proCol: 'pro_only',
    orderBy: 'id',
    extraSelect: `slug, name, frame_class, badge_emoji, price_coins AS price_coins, pro_only`,
    mapRow: (row, owned, user) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      frameClass: row.frame_class,
      badgeEmoji: row.badge_emoji,
      priceCoins: row.price_coins,
      owned: owned.has(row.id as number),
      equipped: user.equipped_profile_flair_id === row.id,
      proOnly: row.pro_only,
    }),
  },
}

function isCosmeticKind(value: unknown): value is CosmeticKind {
  return value === 'theme' || value === 'mine_skin' || value === 'victory_effect' || value === 'profile_flair'
}

async function loadOwned(userId: string, cfg: CatalogConfig): Promise<Set<number>> {
  const r = await pool.query<{ item_id: number }>(
    `SELECT ${cfg.itemIdCol} AS item_id FROM ${cfg.userTable} WHERE user_id = $1`,
    [userId],
  )
  return new Set(r.rows.map((row) => row.item_id))
}

async function loadCatalogKind(user: AuthedUser, kind: CosmeticKind) {
  const cfg = CATALOG[kind]
  const items = await pool.query<Record<string, unknown>>(
    `SELECT id, ${cfg.extraSelect} FROM ${cfg.table} ORDER BY ${cfg.orderBy}`,
  )
  const owned = await loadOwned(user.id, cfg)
  return items.rows.map((row) => cfg.mapRow(row, owned, user))
}

async function purchaseItem(user: AuthedUser, kind: CosmeticKind, itemId: number) {
  const cfg = CATALOG[kind]
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const item = await client.query<{ price_coins: number; pro_only: boolean }>(
      `SELECT price_coins, ${cfg.proCol} AS pro_only FROM ${cfg.table} WHERE id = $1 FOR UPDATE`,
      [itemId],
    )
    if (item.rows.length === 0) {
      await client.query('ROLLBACK')
      return { status: 404 as const, body: { error: 'Item not found' } }
    }

    if (item.rows[0]!.pro_only && !user.is_pro) {
      await client.query('ROLLBACK')
      return { status: 403 as const, body: { error: 'Pro membership required', proRequired: true } }
    }

    const own = await client.query(
      `SELECT 1 FROM ${cfg.userTable} WHERE user_id = $1 AND ${cfg.itemIdCol} = $2`,
      [user.id, itemId],
    )
    if (own.rows.length > 0) {
      await client.query('ROLLBACK')
      return { status: 409 as const, body: { error: 'Already owned' } }
    }

    const price = item.rows[0]!.price_coins
    const u = await client.query<{ coins: number }>(
      `SELECT coins FROM users WHERE id = $1 FOR UPDATE`,
      [user.id],
    )
    const coins = u.rows[0]?.coins ?? 0
    if (coins < price) {
      await client.query('ROLLBACK')
      return { status: 402 as const, body: { error: 'Insufficient coins' } }
    }

    await client.query(`UPDATE users SET coins = coins - $1 WHERE id = $2`, [price, user.id])
    await client.query(
      `INSERT INTO ${cfg.userTable} (user_id, ${cfg.itemIdCol}) VALUES ($1, $2)`,
      [user.id, itemId],
    )

    await client.query('COMMIT')

    const after = await pool.query<{ coins: number }>(`SELECT coins FROM users WHERE id = $1`, [user.id])
    return { status: 200 as const, body: { ok: true, coins: after.rows[0]?.coins ?? 0 } }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

async function equipItem(user: AuthedUser, kind: CosmeticKind, itemId: number) {
  const cfg = CATALOG[kind]
  const own = await pool.query(
    `SELECT 1 FROM ${cfg.userTable} WHERE user_id = $1 AND ${cfg.itemIdCol} = $2`,
    [user.id, itemId],
  )
  if (own.rows.length === 0) {
    return { status: 403 as const, body: { error: 'Item not owned' } }
  }

  const exists = await pool.query(`SELECT 1 FROM ${cfg.table} WHERE id = $1`, [itemId])
  if (exists.rows.length === 0) {
    return { status: 404 as const, body: { error: 'Item not found' } }
  }

  await pool.query(`UPDATE users SET ${cfg.equipCol} = $1 WHERE id = $2`, [itemId, user.id])
  return { status: 200 as const, body: { ok: true } }
}

export async function grantDefaultCosmetics(userId: string, defaultThemeId: number) {
  await pool.query(
    `INSERT INTO user_themes (user_id, theme_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, defaultThemeId],
  )

  const freeGrants = [
    { table: 'user_mine_skins', col: 'mine_skin_id', slug: 'classic-mine', from: 'mine_skins' },
    {
      table: 'user_victory_effects',
      col: 'victory_effect_id',
      slug: 'confetti',
      from: 'victory_effects',
    },
    {
      table: 'user_profile_flairs',
      col: 'profile_flair_id',
      slug: 'plain',
      from: 'profile_flairs',
    },
  ] as const

  for (const g of freeGrants) {
    await pool.query(
      `INSERT INTO ${g.table} (user_id, ${g.col})
       SELECT $1, id FROM ${g.from} WHERE slug = $2
       ON CONFLICT DO NOTHING`,
      [userId, g.slug],
    )
  }

  await pool.query(
    `UPDATE users SET
       equipped_mine_skin_id = COALESCE(equipped_mine_skin_id, (SELECT id FROM mine_skins WHERE slug = 'classic-mine')),
       equipped_victory_effect_id = COALESCE(equipped_victory_effect_id, (SELECT id FROM victory_effects WHERE slug = 'confetti')),
       equipped_profile_flair_id = COALESCE(equipped_profile_flair_id, (SELECT id FROM profile_flairs WHERE slug = 'plain'))
     WHERE id = $1`,
    [userId],
  )
}

export async function registerMarketRoutes(app: FastifyInstance) {
  app.get('/api/market/catalog', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const [themes, mineSkins, victoryEffects, profileFlairs] = await Promise.all([
      loadCatalogKind(user, 'theme'),
      loadCatalogKind(user, 'mine_skin'),
      loadCatalogKind(user, 'victory_effect'),
      loadCatalogKind(user, 'profile_flair'),
    ])

    return { themes, mineSkins, victoryEffects, profileFlairs, isPro: user.is_pro }
  })

  app.post<{ Body: { kind?: string; itemId?: number } }>('/api/market/purchase-item', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const kind = req.body?.kind
    const itemId = req.body?.itemId
    if (!isCosmeticKind(kind) || typeof itemId !== 'number' || !Number.isInteger(itemId)) {
      return reply.status(400).send({ error: 'kind and itemId required' })
    }

    const result = await purchaseItem(user, kind, itemId)
    return reply.status(result.status).send(result.body)
  })

  app.post<{ Body: { kind?: string; itemId?: number } }>('/api/me/equip-item', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const kind = req.body?.kind
    const itemId = req.body?.itemId
    if (!isCosmeticKind(kind) || typeof itemId !== 'number' || !Number.isInteger(itemId)) {
      return reply.status(400).send({ error: 'kind and itemId required' })
    }

    const result = await equipItem(user, kind, itemId)
    return reply.status(result.status).send(result.body)
  })
}
