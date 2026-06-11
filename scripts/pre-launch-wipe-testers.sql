-- Pre-launch tester data wipe
-- Removes all driver accounts and their data. Preserves listings, host
-- accounts, admin_settings, and migrations — everything needed for launch.
--
-- Run against production DB before going live:
--   psql "$DATABASE_URL" -f scripts/pre-launch-wipe-testers.sql
--
-- DRY RUN FIRST — uncomment the SELECT blocks below to see what will be
-- deleted before you commit to the DELETE statements.
--
-- Safe to re-run: deleting already-deleted rows is a no-op.

BEGIN;

-- ----------------------------------------------------------------
-- 1. Audit what will be removed (uncomment to dry-run)
-- ----------------------------------------------------------------
-- SELECT COUNT(*) AS driver_accounts  FROM users        WHERE role = 'driver';
-- SELECT COUNT(*) AS bookings         FROM bookings      WHERE driver_id IN (SELECT id FROM users WHERE role = 'driver');
-- SELECT COUNT(*) AS reviews          FROM reviews;
-- SELECT COUNT(*) AS push_tokens      FROM push_tokens   WHERE user_id    IN (SELECT id FROM users WHERE role = 'driver');
-- SELECT COUNT(*) AS favorites        FROM favorites     WHERE user_id    IN (SELECT id FROM users WHERE role = 'driver');
-- SELECT COUNT(*) AS support_tickets  FROM support_tickets WHERE user_id  IN (SELECT id FROM users WHERE role = 'driver');
-- SELECT COUNT(*) AS refresh_tokens   FROM refresh_tokens  WHERE user_id  IN (SELECT id FROM users WHERE role = 'driver');
-- SELECT COUNT(*) AS scheduled_notifs FROM scheduled_notifications WHERE user_id IN (SELECT id FROM users WHERE role = 'driver');
-- SELECT COUNT(*) AS event_log_rows   FROM event_log     WHERE user_id    IN (SELECT id FROM users WHERE role = 'driver');

-- ----------------------------------------------------------------
-- 2. Wipe data that belongs to driver accounts
--    (order matters — child rows before parent)
-- ----------------------------------------------------------------

DELETE FROM scheduled_notifications
  WHERE user_id IN (SELECT id FROM users WHERE role = 'driver');

DELETE FROM push_tokens
  WHERE user_id IN (SELECT id FROM users WHERE role = 'driver');

DELETE FROM favorites
  WHERE user_id IN (SELECT id FROM users WHERE role = 'driver');

DELETE FROM support_tickets
  WHERE user_id IN (SELECT id FROM users WHERE role = 'driver');

DELETE FROM event_log
  WHERE user_id IN (SELECT id FROM users WHERE role = 'driver');

-- reviews reference bookings; delete before bookings
DELETE FROM reviews
  WHERE booking_id IN (
    SELECT id FROM bookings
    WHERE driver_id IN (SELECT id FROM users WHERE role = 'driver')
  );

-- refunds and disputes reference bookings
DELETE FROM refunds
  WHERE booking_id IN (
    SELECT id FROM bookings
    WHERE driver_id IN (SELECT id FROM users WHERE role = 'driver')
  );

DELETE FROM disputes
  WHERE booking_id IN (
    SELECT id FROM bookings
    WHERE driver_id IN (SELECT id FROM users WHERE role = 'driver')
  );

DELETE FROM bookings
  WHERE driver_id IN (SELECT id FROM users WHERE role = 'driver');

-- refresh_tokens / password_reset / phone_verification reference users
DELETE FROM refresh_tokens
  WHERE user_id IN (SELECT id FROM users WHERE role = 'driver');

-- audit_log may reference users — soft delete by nulling user_id if FK allows,
-- otherwise delete. Check your FK definition; if ON DELETE CASCADE is set this
-- row is handled automatically when users are deleted below.
DELETE FROM audit_log
  WHERE user_id IN (SELECT id FROM users WHERE role = 'driver');

-- ----------------------------------------------------------------
-- 3. Delete the driver accounts themselves
-- ----------------------------------------------------------------

DELETE FROM users WHERE role = 'driver';

-- ----------------------------------------------------------------
-- 4. Verify nothing driver-related remains
-- ----------------------------------------------------------------

DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining FROM users WHERE role = 'driver';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Wipe incomplete: % driver accounts still exist', remaining;
  END IF;
END $$;

COMMIT;
