import type {
  CosmeticKind,
  MarketMineSkin,
  MarketProfileFlair,
  MarketVictoryEffect,
  MineVariant,
  VictoryVariant,
} from '../cosmetics/types'

const SESSION_TOKEN_KEY = 'sapper_session_token'

const base = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function wsBase(): string {
  return base().replace(/^http/i, 'ws')
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}

function setSessionToken(token: string) {
  localStorage.setItem(SESSION_TOKEN_KEY, token)
}

function clearSessionToken() {
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

export type MeResponse = {
  email: string
  username: string | null
  displayName: string | null
  city: string | null
  coins: number
  equippedThemeId: number | null
  equippedThemeSlug: string
  equippedMineSkinSlug: string
  equippedMineVariant: MineVariant
  equippedVictoryEffectSlug: string
  equippedVictoryVariant: VictoryVariant
  equippedProfileFlairSlug: string
  equippedProfileFlairFrame: string
  equippedProfileFlairBadge: string
  ownedThemeIds: number[]
  isPro: boolean
}

export type MarketTheme = {
  id: number
  slug: string
  name: string
  priceCoins: number
  owned: boolean
  equipped: boolean
  proOnly: boolean
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

function messageFromErrorBody(text: string, fallback: string): string {
  if (!text.trim()) return fallback
  try {
    const j = JSON.parse(text) as { error?: string; message?: string }
    return (j.message ?? j.error ?? text).trim() || fallback
  } catch {
    return text.trim() || fallback
  }
}

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text()
  return messageFromErrorBody(text, res.statusText || fallback)
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getSessionToken()
  return fetch(`${base()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
}

export async function getMe(): Promise<MeResponse | null> {
  const res = await apiFetch('/api/me')
  if (res.status === 401) return null
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load profile'))
  return parseJson<MeResponse>(res)
}

export async function register(body: {
  email: string
  password: string
  username: string
  city?: string
}): Promise<void> {
  const res = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Registration failed'))
  const data = await parseJson<{ token?: string }>(res)
  if (data.token) setSessionToken(data.token)
}

export async function updateCity(city: string | null): Promise<{ city: string | null }> {
  const res = await apiFetch('/api/me/city', {
    method: 'PATCH',
    body: JSON.stringify({ city }),
  })
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to update city'))
  return parseJson<{ city: string | null }>(res)
}

export async function login(body: { email: string; password: string }): Promise<void> {
  const res = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Login failed'))
  const data = await parseJson<{ token?: string }>(res)
  if (data.token) setSessionToken(data.token)
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' })
  } finally {
    clearSessionToken()
  }
}

export async function getMarketThemes(): Promise<{ themes: MarketTheme[]; isPro: boolean }> {
  const res = await apiFetch('/api/market/themes')
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load market'))
  return parseJson<{ themes: MarketTheme[]; isPro: boolean }>(res)
}

export async function purchaseTheme(themeId: number): Promise<{ coins: number }> {
  const res = await apiFetch('/api/market/purchase', {
    method: 'POST',
    body: JSON.stringify({ themeId }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(messageFromErrorBody(text, 'Purchase failed'))
  const j = JSON.parse(text) as { coins?: number }
  return { coins: j.coins ?? 0 }
}

export async function equipTheme(themeId: number): Promise<void> {
  const res = await apiFetch('/api/me/equip', {
    method: 'POST',
    body: JSON.stringify({ themeId }),
  })
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Equip failed'))
}

export type MarketCatalog = {
  themes: MarketTheme[]
  mineSkins: MarketMineSkin[]
  victoryEffects: MarketVictoryEffect[]
  profileFlairs: MarketProfileFlair[]
  isPro: boolean
}

export async function getMarketCatalog(): Promise<MarketCatalog> {
  const res = await apiFetch('/api/market/catalog')
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load market'))
  return parseJson<MarketCatalog>(res)
}

export async function purchaseMarketItem(
  kind: CosmeticKind,
  itemId: number,
): Promise<{ coins: number }> {
  const res = await apiFetch('/api/market/purchase-item', {
    method: 'POST',
    body: JSON.stringify({ kind, itemId }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(messageFromErrorBody(text, 'Purchase failed'))
  const j = JSON.parse(text) as { coins?: number }
  return { coins: j.coins ?? 0 }
}

export async function equipMarketItem(kind: CosmeticKind, itemId: number): Promise<void> {
  const res = await apiFetch('/api/me/equip-item', {
    method: 'POST',
    body: JSON.stringify({ kind, itemId }),
  })
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Equip failed'))
}

export async function claimWinReward(): Promise<{ granted: number; coins: number }> {
  const res = await apiFetch('/api/rewards/win', { method: 'POST', body: '{}' })
  const text = await res.text()
  if (!res.ok) throw new Error(messageFromErrorBody(text, 'Reward failed'))
  const j = JSON.parse(text) as { granted?: number; coins?: number }
  return { granted: j.granted ?? 0, coins: j.coins ?? 0 }
}

export type DifficultyPreset = {
  id: number
  slug: string
  rows: number
  cols: number
  mines: number
}

export async function getDifficulties(): Promise<DifficultyPreset[]> {
  const res = await apiFetch('/api/difficulties')
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load difficulties'))
  const j = await parseJson<{ presets: DifficultyPreset[] }>(res)
  return j.presets
}

export type LeaderboardDifficulty = 'beginner' | 'intermediate' | 'expert' | 'speed'

export type LeaderboardEntry = {
  rank: number
  username: string | null
  displayName: string | null
  city: string | null
  flairBadge?: string | null
  flairFrame?: string | null
  /** Best clearing time in ms — present for time-ranked modes; for speed it may be null if user never won. */
  bestMs: number | null
  /** Speed-mode only: best score (cells × 10 + leftover-time bonus). */
  bestScore?: number
  gamesPlayed: number
}

export async function fetchLeaderboard(
  difficulty: LeaderboardDifficulty,
  city?: string | null,
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({ difficulty })
  if (city) params.set('city', city)
  const res = await apiFetch(`/api/leaderboard?${params.toString()}`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load leaderboard'))
  const j = await parseJson<{ items: LeaderboardEntry[] }>(res)
  return j.items
}

export type LeaderboardCity = { city: string; playerCount: number }

export async function fetchLeaderboardCities(): Promise<LeaderboardCity[]> {
  const res = await apiFetch('/api/leaderboard/cities')
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load cities'))
  const j = await parseJson<{ cities: LeaderboardCity[] }>(res)
  return j.cities
}

export type GameMove = { a: 'r' | 'f' | 'c'; r: number; c: number; t: number }

export type SubmitGameInput = {
  status: 'won' | 'lost' | 'abandoned'
  durationMs: number
  score: number
  moves: GameMove[]
  seed: number
  rows: number
  cols: number
  mines: number
  presetSlug?: string
  startedAt?: string
  endedAt?: string
}

export type SubmitGameResult = { gameId: string; coins: number; grantedCoins: number }

export async function submitGame(input: SubmitGameInput): Promise<SubmitGameResult> {
  const res = await apiFetch('/api/games', { method: 'POST', body: JSON.stringify(input) })
  const text = await res.text()
  if (!res.ok) throw new Error(messageFromErrorBody(text, 'Submit failed'))
  const j = JSON.parse(text) as Partial<SubmitGameResult>
  return {
    gameId: j.gameId ?? '',
    coins: j.coins ?? 0,
    grantedCoins: j.grantedCoins ?? 0,
  }
}

export type GameListItem = {
  id: string
  presetSlug: string | null
  rows: number
  cols: number
  mines: number
  status: 'won' | 'lost' | 'abandoned'
  durationMs: number
  score: number
  endedAt: string
}

export type GameListQuery = {
  cursor?: string
  difficulty?: string
  outcome?: 'won' | 'lost' | 'abandoned'
  from?: string
  to?: string
  limit?: number
}

export async function listGames(
  query: GameListQuery = {},
): Promise<{ items: GameListItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams()
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.difficulty) params.set('difficulty', query.difficulty)
  if (query.outcome) params.set('outcome', query.outcome)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.limit) params.set('limit', String(query.limit))
  const qs = params.toString()
  const res = await apiFetch(`/api/games${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load games'))
  return parseJson<{ items: GameListItem[]; nextCursor: string | null }>(res)
}

export type GameDetail = {
  id: string
  presetSlug: string | null
  rows: number
  cols: number
  mines: number
  seed: number
  status: 'won' | 'lost' | 'abandoned'
  durationMs: number
  score: number
  moves: GameMove[]
  startedAt: string
  endedAt: string
}

export async function getGame(id: string): Promise<GameDetail> {
  const res = await apiFetch(`/api/games/${id}`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load game'))
  return parseJson<GameDetail>(res)
}

export type UserStats = {
  gamesPlayed: number
  wins: number
  bestTimeBeginnerMs: number | null
  bestTimeIntermediateMs: number | null
  bestTimeExpertMs: number | null
}

export async function getMyStats(): Promise<UserStats> {
  const res = await apiFetch('/api/me/stats')
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load stats'))
  return parseJson<UserStats>(res)
}

export type DailyChallenge = {
  date: string
  seed: number
  presetSlug: string
  rows: number
  cols: number
  mines: number
  alreadyPlayed: boolean
  attemptGameId: string | null
}

export type CheckoutSession = {
  sessionId: string
  amountCents: number
  checkoutPath: string
}

export async function startProCheckout(): Promise<CheckoutSession> {
  const res = await apiFetch('/api/billing/checkout', { method: 'POST', body: '{}' })
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Checkout failed'))
  return parseJson<CheckoutSession>(res)
}

export async function confirmProCheckout(sessionId: string): Promise<{ ok: boolean }> {
  const res = await apiFetch('/api/billing/confirm', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(messageFromErrorBody(text, 'Confirm failed'))
  return JSON.parse(text) as { ok: boolean }
}

export async function getDailyToday(): Promise<DailyChallenge> {
  const res = await apiFetch('/api/daily/today')
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load daily challenge'))
  return parseJson<DailyChallenge>(res)
}

export type DailyLeaderboardEntry = {
  rank: number
  username: string | null
  displayName: string | null
  durationMs: number
  status: 'won' | 'lost' | 'abandoned'
  score: number
}

export async function getDailyLeaderboard(
  date?: string,
): Promise<{ date: string; items: DailyLeaderboardEntry[] }> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  const res = await apiFetch(`/api/daily/leaderboard${qs}`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load daily leaderboard'))
  return parseJson<{ date: string; items: DailyLeaderboardEntry[] }>(res)
}

export type DailySubmitInput = {
  status: 'won' | 'lost' | 'abandoned'
  durationMs: number
  score: number
  moves: GameMove[]
}

export type DailySubmitResult = {
  ok?: boolean
  gameId?: string
  attemptGameId?: string | null
  date?: string
  error?: string
  alreadyPlayed?: boolean
}

export async function submitDailyAttempt(input: DailySubmitInput): Promise<DailySubmitResult> {
  const res = await apiFetch('/api/daily/submit', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const text = await res.text()
  if (res.status === 409) {
    let body: { attemptGameId?: string | null } = {}
    try {
      body = JSON.parse(text)
    } catch {
      /* ignore */
    }
    return {
      alreadyPlayed: true,
      attemptGameId: body.attemptGameId ?? null,
    }
  }
  if (!res.ok) throw new Error(messageFromErrorBody(text, 'Daily submit failed'))
  return JSON.parse(text) as DailySubmitResult
}

export type MatchStatus = 'waiting' | 'ready' | 'playing' | 'finished' | 'cancelled'
export type MatchPlayerStatus = 'joined' | 'ready' | 'playing' | 'won' | 'lost' | 'draw' | 'left'

export type MatchPlayer = {
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
}

export type MatchSnapshot = {
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
  players: MatchPlayer[]
  viewerUserId: string
}

export async function createMatch(input: { presetSlug: string }): Promise<MatchSnapshot> {
  const res = await apiFetch('/api/matches', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(messageFromErrorBody(text, 'Failed to create match'))
  return JSON.parse(text) as MatchSnapshot
}

export async function joinMatch(input: { code: string }): Promise<MatchSnapshot> {
  const res = await apiFetch('/api/matches/join', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(messageFromErrorBody(text, 'Failed to join match'))
  return JSON.parse(text) as MatchSnapshot
}

export async function getMatch(matchId: string): Promise<MatchSnapshot> {
  const res = await apiFetch(`/api/matches/${matchId}`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to load match'))
  return parseJson<MatchSnapshot>(res)
}

export type FinishMatchInput = SubmitGameInput & {
  revealedSafeCount: number
  flagsPlaced: number
}

export async function finishMatch(
  matchId: string,
  input: FinishMatchInput,
): Promise<{ gameId: string; match: MatchSnapshot }> {
  const res = await apiFetch(`/api/matches/${matchId}/finish`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(messageFromErrorBody(text, 'Failed to finish match'))
  return JSON.parse(text) as { gameId: string; match: MatchSnapshot }
}

export function matchSocketUrl(matchId: string): string {
  const token = getSessionToken()
  const qs = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${wsBase()}/api/matches/${matchId}/live${qs}`
}
