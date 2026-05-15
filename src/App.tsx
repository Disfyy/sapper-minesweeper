import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { Layout } from './components/Layout/Layout'
import { AnalysisPage } from './pages/AnalysisPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { DailyPage } from './pages/DailyPage'
import { DuelMatchPage } from './pages/DuelMatchPage'
import { DuelPage } from './pages/DuelPage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MarketPage } from './pages/MarketPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { PlayPage } from './pages/PlayPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { UpgradePage } from './pages/UpgradePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/duel" element={<DuelPage />} />
            <Route path="/duel/:matchId" element={<DuelMatchPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/:id" element={<AnalysisPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/upgrade" element={<UpgradePage />} />
            <Route path="/billing/checkout" element={<CheckoutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
