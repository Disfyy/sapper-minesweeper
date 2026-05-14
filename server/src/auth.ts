import jwt from 'jsonwebtoken'

const COOKIE = 'session'

export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

export function signSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: '7d' })
}

export function verifySessionToken(token: string): { userId: string } | null {
  try {
    const p = jwt.verify(token, getJwtSecret()) as { sub?: string }
    if (!p.sub) return null
    return { userId: p.sub }
  } catch {
    return null
  }
}

export const sessionCookieName = COOKIE
