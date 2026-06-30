-- Snapshot the booking-critical *identity* fields onto each booking at creation.
--
-- Previously every booking read joined the live listings row, so when a host
-- edited the address/pin or archived the listing, existing confirmed bookings
-- silently changed under the driver. Market standard (Airbnb, Booking.com,
-- the parking apps) is that a confirmed booking is a contract: it captures the
-- "what/where you booked" so listing edits never relocate it. amount_cents was
-- already frozen; these freeze the location and title.
--
-- Deliberately NOT snapshotted: access code and arrival instructions. Those are
-- *operational* — codes rotate or get corrected, instructions get clarified —
-- and the driver needs the host's latest value to actually get in, so they stay
-- live reads. Freezing them would leave a driver locked out with a stale code.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS listing_address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS listing_latitude DOUBLE PRECISION;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS listing_longitude DOUBLE PRECISION;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS listing_title TEXT;

-- Backfill existing bookings from the listing as it stands now. This is the best
-- we can do retroactively; from here on the values are frozen at booking time.
UPDATE bookings b
SET listing_address = l.address,
    listing_title = l.title,
    listing_latitude = ST_Y(l.geom),
    listing_longitude = ST_X(l.geom)
FROM listings l
WHERE l.id = b.listing_id
  AND b.listing_address IS NULL;
