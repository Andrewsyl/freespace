-- Cached "what's around this space" data (transit, stadiums, landmarks with
-- walking time). Computed once per listing from Google Places and stored here so
-- we don't hit the Places API on every listing view.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS nearby jsonb,
  ADD COLUMN IF NOT EXISTS nearby_updated_at timestamptz;
