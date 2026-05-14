import { createContext } from 'react'
import type { MeResponse } from '../api/client'

export type AuthState = {
  user: MeResponse | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
