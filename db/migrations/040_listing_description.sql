-- Add an editable description to listings. It's auto-generated from the
-- listing's attributes when a host publishes (see the mobile listing flow),
-- but hosts can edit it. Shown as "About this space" on the listing page.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS description text;
