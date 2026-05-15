-- ============================================================
-- 007: Tier 3.5 shop cosmetics — mine skins, victory effects, profile flair
-- ============================================================

CREATE TABLE IF NOT EXISTS mine_skins (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('classic', 'pixel', 'gem', 'void')),
  price_coins INT NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
  pro_only BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_mine_skins (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  mine_skin_id INT NOT NULL REFERENCES mine_skins (id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mine_skin_id)
);

CREATE TABLE IF NOT EXISTS victory_effects (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('confetti', 'sparkles', 'fireworks')),
  price_coins INT NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
  pro_only BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_victory_effects (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  victory_effect_id INT NOT NULL REFERENCES victory_effects (id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, victory_effect_id)
);

CREATE TABLE IF NOT EXISTS profile_flairs (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  frame_class TEXT NOT NULL,
  badge_emoji TEXT NOT NULL DEFAULT '',
  price_coins INT NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
  pro_only BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_profile_flairs (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  profile_flair_id INT NOT NULL REFERENCES profile_flairs (id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, profile_flair_id)
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS equipped_mine_skin_id INT REFERENCES mine_skins (id),
  ADD COLUMN IF NOT EXISTS equipped_victory_effect_id INT REFERENCES victory_effects (id),
  ADD COLUMN IF NOT EXISTS equipped_profile_flair_id INT REFERENCES profile_flairs (id);

INSERT INTO mine_skins (slug, name, variant, price_coins, pro_only)
VALUES
  ('classic-mine', 'Classic Mine', 'classic', 0, FALSE),
  ('pixel-mine', 'Pixel Mine', 'pixel', 150, FALSE),
  ('gem-mine', 'Gem Mine', 'gem', 300, FALSE),
  ('void-mine', 'Void Mine', 'void', 450, FALSE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO victory_effects (slug, name, variant, price_coins, pro_only)
VALUES
  ('confetti', 'Confetti', 'confetti', 0, FALSE),
  ('sparkles', 'Sparkles', 'sparkles', 120, FALSE),
  ('fireworks', 'Fireworks', 'fireworks', 280, FALSE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO profile_flairs (slug, name, frame_class, badge_emoji, price_coins, pro_only)
VALUES
  ('plain', 'Plain', 'flair-plain', '', 0, FALSE),
  ('bronze-ring', 'Bronze Ring', 'flair-bronze', '🥉', 100, FALSE),
  ('gold-crown', 'Gold Crown', 'flair-gold', '👑', 220, FALSE),
  ('neon-pulse', 'Neon Pulse', 'flair-neon', '✨', 380, FALSE),
  ('crystal', 'Crystal (Pro)', 'flair-crystal', '💎', 0, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Grant free catalog items to every existing user
INSERT INTO user_mine_skins (user_id, mine_skin_id)
SELECT u.id, s.id FROM users u CROSS JOIN mine_skins s WHERE s.slug = 'classic-mine'
ON CONFLICT DO NOTHING;

INSERT INTO user_victory_effects (user_id, victory_effect_id)
SELECT u.id, v.id FROM users u CROSS JOIN victory_effects v WHERE v.slug = 'confetti'
ON CONFLICT DO NOTHING;

INSERT INTO user_profile_flairs (user_id, profile_flair_id)
SELECT u.id, p.id FROM users u CROSS JOIN profile_flairs p WHERE p.slug = 'plain'
ON CONFLICT DO NOTHING;

UPDATE users
SET equipped_mine_skin_id = (SELECT id FROM mine_skins WHERE slug = 'classic-mine')
WHERE equipped_mine_skin_id IS NULL;

UPDATE users
SET equipped_victory_effect_id = (SELECT id FROM victory_effects WHERE slug = 'confetti')
WHERE equipped_victory_effect_id IS NULL;

UPDATE users
SET equipped_profile_flair_id = (SELECT id FROM profile_flairs WHERE slug = 'plain')
WHERE equipped_profile_flair_id IS NULL;
