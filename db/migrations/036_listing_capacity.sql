-- Add capacity to listings and replace the hard 1-booking exclusion constraint
-- with a trigger-based check that allows up to capacity concurrent bookings.

-- 1. Add the capacity column (default 1 preserves existing behaviour).
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 1;

-- 2. Drop the old exclusion constraint that blocks ALL concurrent bookings for
--    the same listing_id.  The trigger below replaces it with a capacity-aware
--    check, so we no longer want a blanket exclusion.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap'
  ) THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_no_overlap;
  END IF;
END $$;

-- 3. Trigger function: before every INSERT on bookings, count active overlapping
--    bookings for the same listing and raise an exception if the listing is
--    already at capacity.  The table lock prevents two concurrent INSERTs from
--    racing past the count check simultaneously.
CREATE OR REPLACE FUNCTION check_booking_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity integer;
  v_booked   integer;
BEGIN
  -- Serialise concurrent booking attempts for the same listing.
  LOCK TABLE bookings IN SHARE ROW EXCLUSIVE MODE;

  -- Read the listing's capacity.
  SELECT capacity INTO v_capacity
  FROM listings
  WHERE id = NEW.listing_id;

  -- Count active (non-canceled) bookings that overlap the requested window.
  SELECT COUNT(*) INTO v_booked
  FROM bookings
  WHERE listing_id = NEW.listing_id
    AND (status IS NULL OR status <> 'canceled')
    AND tstzrange(start_time, end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)');

  IF v_booked >= v_capacity THEN
    RAISE EXCEPTION 'listing_at_capacity'
      USING ERRCODE = 'P0001',
            HINT    = 'No spaces available for the selected time';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Attach the trigger (drop first so the migration is re-runnable).
DROP TRIGGER IF EXISTS trg_check_booking_capacity ON bookings;

CREATE TRIGGER trg_check_booking_capacity
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_capacity();
