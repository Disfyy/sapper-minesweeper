import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL
// Render Postgres (internal + external) requires SSL; hosts are often `dpg-…` without render.com.
const useSsl =
  process.env.PGSSLMODE === 'require' ||
  (process.env.NODE_ENV === 'production' &&
    !!connectionString &&
    (connectionString.includes('render.com') || /@dpg-/.test(connectionString)))

export const pool = new Pool({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
})
