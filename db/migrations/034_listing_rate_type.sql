ALTER TABLE listings
ADD COLUMN IF NOT EXISTS rate_type TEXT NOT NULL DEFAULT 'daily';

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS price_per_hour NUMERIC(10, 2);

UPDATE listings
SET rate_type = COALESCE(NULLIF(rate_type, ''), 'daily')
WHERE rate_type IS NULL OR rate_type = '';

ALTER TABLE listings
DROP CONSTRAINT IF EXISTS listings_rate_type_check;

ALTER TABLE listings
ADD CONSTRAINT listings_rate_type_check
CHECK (rate_type IN ('hourly', 'daily'));

UPDATE listings
SET price_per_hour = NULL
WHERE rate_type = 'daily';
