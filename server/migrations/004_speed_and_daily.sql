-- ============================================================
-- 004: Speed-mode preset + Daily Challenge tables
-- ============================================================

-- ---- Speed preset (2-minute sprint, beginner geometry) ----
INSERT INTO difficulty_presets (slug, rows, cols, mines)
VALUES ('speed', 9, 9, 10)
ON CONFLICT (slug) DO NOTHING;

-- ---- Daily Challenge: shared seeded board per UTC day ----
CREATE TABLE IF NOT EXISTS daily_challenges (
  challenge_date DATE PRIMARY KEY,
  seed BIGINT NOT NULL,
  preset_slug TEXT NOT NULL,
  rows INT NOT NULL CHECK (rows > 0),
  cols INT NOT NULL CHECK (cols > 0),
  mines INT NOT NULL CHECK (mines > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One ranked attempt per user per day.
CREATE TABLE IF NOT EXISTS daily_attempts (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL REFERENCES daily_challenges (challenge_date) ON DELETE CASCADE,
  game_id BIGINT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('won', 'lost', 'abandoned')),
  duration_ms INT NOT NULL CHECK (duration_ms >= 0),
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_attempts_date_duration
  ON daily_attempts (challenge_date, duration_ms ASC)
  WHERE status = 'won';

CREATE INDEX IF NOT EXISTS idx_daily_attempts_date_score
  ON daily_attempts (challenge_date, score DESC);
