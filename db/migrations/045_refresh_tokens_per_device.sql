-- users.refresh_token_hash held a single refresh token per account, so
-- signing in on a second device invalidated the first device's session within
-- the access token's 7-day lifetime. Store one refresh token per device
-- instead. The legacy users column is kept for tokens issued before this
-- deploy; /refresh migrates those rows lazily.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
