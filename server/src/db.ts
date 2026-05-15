import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL
const useSsl =
  process.env.PGSSLMODE === 'require' ||
  (process.env.NODE_ENV === 'production' && connectionString?.includes('render.com'))

export const pool = new Pool({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
})
