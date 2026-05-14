ALTER TABLE win_reward_log
  ADD COLUMN IF NOT EXISTS game_id BIGINT REFERENCES games(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE win_reward_log
    ADD CONSTRAINT win_reward_log_game_unique UNIQUE (game_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_games_preset_duration_won
  ON games (preset_id, duration_ms ASC)
  WHERE status = 'won';
