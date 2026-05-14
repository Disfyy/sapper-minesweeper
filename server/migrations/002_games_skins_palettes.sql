-- ============================================================
-- 002: Games + cosmetic surfaces (flag skins, number palettes)
-- ============================================================

-- ---- Cosmetic surface 1: flag skins ----
CREATE TABLE IF NOT EXISTS flag_skins (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  glyph TEXT NOT NULL DEFAULT '🚩',
  price_coins INT NOT NULL DEFAULT 0 CHECK (price_coins >= 0)
);

CREATE TABLE IF NOT EXISTS user_flag_skins (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  flag_skin_id INT NOT NULL REFERENCES flag_skins (id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, flag_skin_id)
);

-- ---- Cosmetic surface 2: number palettes ----
CREATE TABLE IF NOT EXISTS number_palettes (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  colors JSONB NOT NULL,
  price_coins INT NOT NULL DEFAULT 0 CHECK (price_coins >= 0)
);

CREATE TABLE IF NOT EXISTS user_number_palettes (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  palette_id INT NOT NULL REFERENCES number_palettes (id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, palette_id)
);

-- ---- Equip slots + username on users ----
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS equipped_flag_skin_id INT REFERENCES flag_skins (id),
  ADD COLUMN IF NOT EXISTS equipped_number_palette_id INT REFERENCES number_palettes (id),
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- ---- Difficulty presets ----
CREATE TABLE IF NOT EXISTS difficulty_presets (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  rows INT NOT NULL CHECK (rows > 0),
  cols INT NOT NULL CHECK (cols > 0),
  mines INT NOT NULL CHECK (mines > 0)
);

-- ---- Games (history) ----
CREATE TABLE IF NOT EXISTS games (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  preset_id INT REFERENCES difficulty_presets (id),
  rows INT NOT NULL,
  cols INT NOT NULL,
  mines INT NOT NULL,
  seed BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('won', 'lost', 'abandoned')),
  duration_ms INT NOT NULL CHECK (duration_ms >= 0),
  score INT NOT NULL DEFAULT 0,
  moves JSONB NOT NULL,
  match_id BIGINT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_user_ended ON games (user_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_user_preset ON games (user_id, preset_id);

-- ---- Cached per-user aggregates ----
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  best_time_beginner_ms INT,
  best_time_intermediate_ms INT,
  best_time_expert_ms INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Seed difficulty presets ----
INSERT INTO difficulty_presets (slug, rows, cols, mines)
VALUES
  ('beginner', 9, 9, 10),
  ('intermediate', 16, 16, 40),
  ('expert', 16, 30, 99)
ON CONFLICT (slug) DO NOTHING;

-- ---- Seed flag skins ----
INSERT INTO flag_skins (slug, name, color, glyph, price_coins)
VALUES
  ('classic-red', 'Classic Red', '#ef4444', '🚩', 0),
  ('royal-blue', 'Royal Blue', '#3b82f6', '🚩', 100),
  ('gold-leaf', 'Gold Leaf', '#fbbf24', '🚩', 250),
  ('emerald', 'Emerald', '#10b981', '🚩', 250),
  ('skull', 'Skull', '#a855f7', '💀', 400)
ON CONFLICT (slug) DO NOTHING;

-- ---- Seed number palettes ----
INSERT INTO number_palettes (slug, name, colors, price_coins)
VALUES
  (
    'classic',
    'Classic',
    '{"1":"#1976d2","2":"#388e3c","3":"#d32f2f","4":"#7b1fa2","5":"#5d4037","6":"#0097a7","7":"#212121","8":"#616161"}'::jsonb,
    0
  ),
  (
    'pastel',
    'Pastel',
    '{"1":"#90caf9","2":"#a5d6a7","3":"#ef9a9a","4":"#ce93d8","5":"#bcaaa4","6":"#80deea","7":"#bdbdbd","8":"#eeeeee"}'::jsonb,
    150
  ),
  (
    'neon',
    'Neon',
    '{"1":"#00e5ff","2":"#76ff03","3":"#ff1744","4":"#d500f9","5":"#ffea00","6":"#1de9b6","7":"#ff9100","8":"#ffffff"}'::jsonb,
    250
  )
ON CONFLICT (slug) DO NOTHING;

-- ---- Default-equip cosmetics for all users (existing + future) ----
UPDATE users
SET equipped_flag_skin_id = (SELECT id FROM flag_skins WHERE slug = 'classic-red')
WHERE equipped_flag_skin_id IS NULL;

UPDATE users
SET equipped_number_palette_id = (SELECT id FROM number_palettes WHERE slug = 'classic')
WHERE equipped_number_palette_id IS NULL;
