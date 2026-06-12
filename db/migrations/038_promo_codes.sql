CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  max_redemptions_per_user integer NOT NULL DEFAULT 1 CHECK (max_redemptions_per_user > 0),
  min_amount_cents integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A redemption is a non-canceled booking that references the code.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES promo_codes(id),
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS bookings_promo_code_id_idx ON bookings(promo_code_id) WHERE promo_code_id IS NOT NULL;
