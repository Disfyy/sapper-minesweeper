-- ============================================================
-- 006: Per-user city for the geographic leaderboard ("Топ игроков из Алматы")
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS city VARCHAR(64);

-- Used by the city-filtered leaderboard query (WHERE u.city = $X).
CREATE INDEX IF NOT EXISTS idx_users_city ON users (city) WHERE city IS NOT NULL;
