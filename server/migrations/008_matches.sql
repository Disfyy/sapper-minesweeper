CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  preset_id INT REFERENCES difficulty_presets (id),
  rows INT NOT NULL CHECK (rows > 0),
  cols INT NOT NULL CHECK (cols > 0),
  mines INT NOT NULL CHECK (mines > 0),
  seed BIGINT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'race' CHECK (mode IN ('race')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'playing', 'finished', 'cancelled')),
  winner_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id BIGINT NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('host', 'guest')),
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'ready', 'playing', 'won', 'lost', 'draw', 'left')),
  score INT NOT NULL DEFAULT 0 CHECK (score >= 0),
  duration_ms INT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  revealed_safe_count INT NOT NULL DEFAULT 0 CHECK (revealed_safe_count >= 0),
  flags_placed INT NOT NULL DEFAULT 0 CHECK (flags_placed >= 0),
  game_id BIGINT REFERENCES games (id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, user_id),
  UNIQUE (match_id, side)
);

CREATE INDEX IF NOT EXISTS idx_match_players_user_joined ON match_players (user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_match_id ON games (match_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_match_id_fkey'
  ) THEN
    ALTER TABLE games
      ADD CONSTRAINT games_match_id_fkey
      FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE SET NULL;
  END IF;
END $$;
