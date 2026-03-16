ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verification_token text,
  ADD COLUMN IF NOT EXISTS phone_verification_expires timestamptz;
