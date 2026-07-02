-- The capacity trigger from migration 036 only fired BEFORE INSERT, so
-- extensions/changes that UPDATE a booking's window bypassed capacity
-- enforcement entirely. Re-create the function to exclude the row being
-- written (needed once UPDATE fires it — the old row version would otherwise
-- count against its own new window) and attach the trigger to window updates.
CREATE OR REPLACE FUNCTION check_booking_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity integer;
  v_booked   integer;
BEGIN
  -- Cancelled bookings never contend for capacity.
  IF NEW.status = 'canceled' THEN
    RETURN NEW;
  END IF;

  -- Serialise concurrent booking attempts for the same listing.
  LOCK TABLE bookings IN SHARE ROW EXCLUSIVE MODE;

  SELECT capacity INTO v_capacity
  FROM listings
  WHERE id = NEW.listing_id;

  -- Count active (non-canceled) bookings that overlap the requested window,
  -- excluding this booking itself.
  SELECT COUNT(*) INTO v_booked
  FROM bookings
  WHERE listing_id = NEW.listing_id
    AND id IS DISTINCT FROM NEW.id
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

DROP TRIGGER IF EXISTS trg_check_booking_capacity ON bookings;

CREATE TRIGGER trg_check_booking_capacity
  BEFORE INSERT OR UPDATE OF start_time, end_time ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_capacity();
