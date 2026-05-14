-- ============================================================
-- 005: Pro tier (fake-Stripe demo monetization)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pro_since TIMESTAMPTZ;

ALTER TABLE themes
  ADD COLUMN IF NOT EXISTS pro_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark two existing themes as Pro-exclusive (cosmetic upsell).
UPDATE themes SET pro_only = TRUE WHERE slug IN ('ocean', 'neon');

-- Two brand-new Pro-only themes to make the unlock feel substantial.
INSERT INTO themes (slug, name, price_coins, pro_only)
VALUES
  ('aurora', 'Aurora (Pro)', 0, TRUE),
  ('sunset', 'Sunset (Pro)', 0, TRUE)
ON CONFLICT (slug) DO UPDATE SET pro_only = EXCLUDED.pro_only;

CREATE TABLE IF NOT EXISTS billing_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'expired')) DEFAULT 'pending',
  amount_cents INT NOT NULL DEFAULT 499,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_billing_sessions_user ON billing_sessions (user_id, created_at DESC);
