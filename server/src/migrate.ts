import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '../migrations')

async function ensureSchemaMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function getAppliedSet(): Promise<Set<string>> {
  const r = await pool.query<{ name: string }>(`SELECT name FROM schema_migrations`)
  return new Set(r.rows.map((row) => row.name))
}

async function applyMigration(name: string, sql: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [name])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  await ensureSchemaMigrationsTable()
  const applied = await getAppliedSet()

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let appliedCount = 0
  for (const name of files) {
    if (applied.has(name)) {
      console.log(`✓ ${name} (already applied)`)
      continue
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8')
    console.log(`→ applying ${name}…`)
    await applyMigration(name, sql)
    console.log(`✓ ${name} applied`)
    appliedCount++
  }

  console.log(`Done. ${appliedCount} new migration(s) applied; ${files.length - appliedCount} already in place.`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
