-- Themes catalog
CREATE TABLE IF NOT EXISTS themes (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_coins INT NOT NULL DEFAULT 0 CHECK (price_coins >= 0)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  coins INT NOT NULL DEFAULT 500 CHECK (coins >= 0),
  equipped_theme_id INT REFERENCES themes (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_themes (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  theme_id INT NOT NULL REFERENCES themes (id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, theme_id)
);

CREATE TABLE IF NOT EXISTS win_reward_log (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  coins_granted INT NOT NULL CHECK (coins_granted > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_win_reward_user_day ON win_reward_log (user_id, created_at);

INSERT INTO themes (slug, name, price_coins)
VALUES
  ('default', 'Classic Dark', 0),
  ('ocean', 'Ocean', 150),
  ('forest', 'Forest', 200),
  ('neon', 'Neon', 300)
ON CONFLICT (slug) DO NOTHING;
