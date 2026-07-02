-- Extension/change top-up payments were previously stored by overwriting
-- bookings.payment_intent_id, which meant a later cancellation refunded only
-- the most recent top-up instead of the original charge. Record every top-up
-- in its own table so the original payment_intent_id is never replaced and
-- cancellations can refund all captured payments.
CREATE TABLE IF NOT EXISTS booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_intent_id text NOT NULL UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'eur',
  kind text NOT NULL CHECK (kind IN ('extension', 'change')),
  refund_id text,
  refund_status text,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_payments_booking_id
  ON booking_payments (booking_id);
