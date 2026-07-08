ALTER TABLE listings
  ADD COLUMN vehicle_size_suitability text
  CHECK (vehicle_size_suitability IN ('small', 'medium', 'large', 'van'));
