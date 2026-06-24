import "../loadEnv.js";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL not set. Database calls will fail until configured.");
}

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

type ListingRateType = "hourly" | "daily";
type ListingSearchMode = "daily" | "monthly";

function mapListingRateType(raw: unknown): ListingRateType {
  return raw === "hourly" ? "hourly" : "daily";
}

function mapListingPricing(row: {
  price_per_day: number | string;
  price_per_hour?: number | string | null;
  price_per_month?: number | string | null;
  rate_type?: string | null;
}) {
  return {
    rateType: mapListingRateType(row.rate_type),
    pricePerDay: Number(row.price_per_day),
    pricePerHour: row.price_per_hour == null ? null : Number(row.price_per_hour),
    pricePerMonth: row.price_per_month == null ? null : Number(row.price_per_month),
  };
}

export type UserRecord = {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  phone_verified?: boolean;
  vehicle_make?: string | null;
  vehicle_type?: string | null;
  vehicle_color?: string | null;
  vehicle_plate?: string | null;
  status?: "active" | "suspended";
  password_hash: string;
  role?: "driver" | "host" | "admin";
  host_stripe_account_id?: string | null;
  email_verified?: boolean;
  verification_token?: string | null;
  verification_expires?: Date | null;
  phone_verification_token?: string | null;
  phone_verification_expires?: Date | null;
  refresh_token_hash?: string | null;
  refresh_expires?: Date | null;
  terms_version?: string | null;
  terms_accepted_at?: Date | null;
  privacy_version?: string | null;
  privacy_accepted_at?: Date | null;
};

export type SpaceSearchInput = {
  lat: number;
  lng: number;
  radiusKm: number;
  from: string;
  to: string;
  spaceType?: string;
  priceMin?: number;
  priceMax?: number;
  coveredParking?: boolean;
  evCharging?: boolean;
  securityLevel?: "basic" | "gated" | "cctv";
  vehicleSize?: "motorcycle" | "car" | "van";
  instantBook?: boolean;
  mode?: ListingSearchMode;
  excludeHostId?: string;
};

function vehicleSizeToCapacity(vehicleSize?: SpaceSearchInput["vehicleSize"]) {
  if (vehicleSize === "van") return 2;
  return null;
}

function spaceTypeToFilter(spaceType?: string) {
  const value = spaceType?.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("driveway")) return "%driveway%";
  if (value.includes("garage")) return "%garage%";
  if (value.includes("car park") || value.includes("carpark")) return "%car%park%";
  if (value.includes("road")) return "%road%";
  return `%${value}%`;
}

function oneOffAvailabilityRange(alias: string) {
  return `tstzrange(${alias}.starts_at, CASE WHEN ${alias}.ends_at < ${alias}.starts_at THEN ${alias}.ends_at + interval '1 day' ELSE ${alias}.ends_at END, '[)')`;
}

function recurringAvailabilityRange(alias: string) {
  return `tstzrange(d + (${alias}.starts_at::time), d + (${alias}.ends_at::time) + CASE WHEN ${alias}.ends_at::time < ${alias}.starts_at::time THEN interval '1 day' ELSE interval '0 day' END, '[)')`;
}

export async function findAvailableSpaces(input: SpaceSearchInput) {
  const {
    lat,
    lng,
    radiusKm,
    from,
    to,
    spaceType,
    priceMin,
    priceMax,
    coveredParking,
    evCharging,
    securityLevel,
    vehicleSize,
    mode = "daily",
    excludeHostId,
  } = input;
  const spaceTypeFilter = spaceTypeToFilter(spaceType);
  const minCapacity = vehicleSizeToCapacity(vehicleSize);
  const baseQuery = `
    SELECT
      id,
      title,
      address,
      price_per_day,
      price_per_hour,
      price_per_month,
      rate_type,
      rating,
      rating_count,
      availability_text,
      capacity,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_m
    FROM listings
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND status <> 'archived'
    AND ($6::text IS NULL OR lower(title) LIKE $6 OR lower(availability_text) LIKE $6 OR EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) LIKE $6))
    AND ($7::numeric IS NULL OR price_per_day >= $7)
    AND ($8::numeric IS NULL OR price_per_day <= $8)
    AND ($9::boolean IS NOT TRUE OR EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) IN ('covered', 'garage', 'indoor')))
    AND ($10::boolean IS NOT TRUE OR EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) IN ('ev_charging', 'ev charging', 'ev')))
    AND (
      $11::text IS NULL
      OR $11::text = 'basic'
      OR ($11::text = 'cctv' AND EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) = 'cctv'))
      OR ($11::text = 'gated' AND (
        EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) IN ('gated', 'security'))
        OR lower(title) LIKE '%gated%'
        OR lower(title) LIKE '%secure%'
      ))
    )
    AND ($12::int IS NULL OR COALESCE(capacity, 1) >= $12)
    AND ($13::text <> 'monthly' OR price_per_month IS NOT NULL)
    AND ($14::uuid IS NULL OR host_id != $14)
    AND (
      SELECT COUNT(*) FROM bookings b
      WHERE b.listing_id = listings.id
      AND (b.status IS NULL OR b.status <> 'canceled')
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
    ) < COALESCE(listings.capacity, 1)
    AND NOT EXISTS (
      SELECT 1 FROM listing_availability a
      WHERE a.listing_id = listings.id
        AND a.kind = 'blocked'
        AND (
          (a.repeat_weekdays IS NULL AND ${oneOffAvailabilityRange("a")} && tstzrange($4::timestamptz, $5::timestamptz, '[)'))
          OR (
            a.repeat_weekdays IS NOT NULL
            AND (a.repeat_until IS NULL OR a.repeat_until >= $4::date)
            AND EXISTS (
              SELECT 1
              FROM generate_series(date_trunc('day', $4::timestamptz), date_trunc('day', $5::timestamptz), interval '1 day') d
              WHERE extract(dow FROM d) = ANY(a.repeat_weekdays)
                AND ${recurringAvailabilityRange("a")} && tstzrange($4::timestamptz, $5::timestamptz, '[)')
            )
          )
        )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM listing_availability o WHERE o.listing_id = listings.id AND o.kind = 'open')
      OR EXISTS (
        SELECT 1 FROM listing_availability o
        WHERE o.listing_id = listings.id
          AND o.kind = 'open'
          AND (
            (o.repeat_weekdays IS NULL AND ${oneOffAvailabilityRange("o")} && tstzrange($4::timestamptz, $5::timestamptz, '[)'))
            OR (
              o.repeat_weekdays IS NOT NULL
              AND (o.repeat_until IS NULL OR o.repeat_until >= $4::date)
              AND EXISTS (
                SELECT 1
                FROM generate_series(date_trunc('day', $4::timestamptz), date_trunc('day', $5::timestamptz), interval '1 day') d
                WHERE extract(dow FROM d) = ANY(o.repeat_weekdays)
                  AND ${recurringAvailabilityRange("o")} && tstzrange($4::timestamptz, $5::timestamptz, '[)')
              )
            )
          )
      )
    )
    ORDER BY distance_m ASC
    LIMIT 200;
  `;

  const legacyQuery = `
    SELECT
      id,
      title,
      address,
      price_per_day,
      rating,
      rating_count,
      availability_text,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_m
    FROM listings
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND ($6::text IS NULL OR lower(title) LIKE $6)
    AND ($7::numeric IS NULL OR price_per_day >= $7)
    AND ($8::numeric IS NULL OR price_per_day <= $8)
    AND ($9::uuid IS NULL OR host_id != $9)
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.listing_id = listings.id
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
    )
    ORDER BY distance_m ASC
    LIMIT 200;
  `;

  const params = [
    lng,
    lat,
    radiusKm * 1000,
    from,
    to,
    spaceTypeFilter,
    priceMin ?? null,
    priceMax ?? null,
    coveredParking === true,
    evCharging === true,
    securityLevel ?? null,
    minCapacity,
    mode,
    excludeHostId ?? null,
  ];
  const legacyParams = [
    lng,
    lat,
    radiusKm * 1000,
    from,
    to,
    spaceTypeFilter,
    priceMin ?? null,
    priceMax ?? null,
    excludeHostId ?? null,
  ];
  try {
    const result = await pool.query(
      baseQuery.replace(
        "availability_text,",
        "availability_text, image_urls, amenities,"
      ),
      params
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      address: row.address,
      ...mapListingPricing(row),
      rating: row.rating != null ? Number(row.rating) : null,
      ratingCount: Number(row.rating_count ?? 0),
      availability: row.availability_text,
      imageUrls: row.image_urls ?? [],
      amenities: row.amenities ?? [],
      capacity: row.capacity != null ? Number(row.capacity) : 1,
      distanceKm: Math.round((row.distance_m / 1000) * 10) / 10,
      latitude: row.latitude,
      longitude: row.longitude,
    }));
  } catch (err: any) {
    if (err?.code !== "42703" && err?.code !== "42P01") throw err;
    // Fallback for older schema without image_urls / rating_count / availability table
    const legacy = legacyQuery.replace("rating_count,", "");
    const result = await pool.query(legacy, legacyParams);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      address: row.address,
      ...mapListingPricing(row),
      rating: row.rating != null ? Number(row.rating) : null,
      ratingCount: Number(row.rating_count ?? 0),
      availability: row.availability_text,
      imageUrls: [],
      amenities: [],
      capacity: 1,
      distanceKm: Math.round((row.distance_m / 1000) * 10) / 10,
      latitude: row.latitude,
      longitude: row.longitude,
    }));
  }
}

export async function findSpacesWithAvailability(input: SpaceSearchInput) {
  const {
    lat,
    lng,
    radiusKm,
    from,
    to,
    spaceType,
    priceMin,
    priceMax,
    coveredParking,
    evCharging,
    securityLevel,
    vehicleSize,
    instantBook,
    mode = "daily",
    excludeHostId,
  } = input;
  const spaceTypeFilter = spaceTypeToFilter(spaceType);
  const minCapacity = vehicleSizeToCapacity(vehicleSize);
  const availabilityCheck = `
    (
      SELECT COUNT(*) FROM bookings b
      WHERE b.listing_id = listings.id
      AND (b.status IS NULL OR b.status <> 'canceled')
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
    ) < COALESCE(listings.capacity, 1)
    AND NOT EXISTS (
      SELECT 1 FROM listing_availability a
      WHERE a.listing_id = listings.id
        AND a.kind = 'blocked'
        AND (
          (a.repeat_weekdays IS NULL AND ${oneOffAvailabilityRange("a")} && tstzrange($4::timestamptz, $5::timestamptz, '[)'))
          OR (
            a.repeat_weekdays IS NOT NULL
            AND (a.repeat_until IS NULL OR a.repeat_until >= $4::date)
            AND EXISTS (
              SELECT 1
              FROM generate_series(date_trunc('day', $4::timestamptz), date_trunc('day', $5::timestamptz), interval '1 day') d
              WHERE extract(dow FROM d) = ANY(a.repeat_weekdays)
                AND ${recurringAvailabilityRange("a")} && tstzrange($4::timestamptz, $5::timestamptz, '[)')
            )
          )
        )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM listing_availability o WHERE o.listing_id = listings.id AND o.kind = 'open')
      OR EXISTS (
        SELECT 1 FROM listing_availability o
        WHERE o.listing_id = listings.id
          AND o.kind = 'open'
          AND (
            (o.repeat_weekdays IS NULL AND ${oneOffAvailabilityRange("o")} && tstzrange($4::timestamptz, $5::timestamptz, '[)'))
            OR (
              o.repeat_weekdays IS NOT NULL
              AND (o.repeat_until IS NULL OR o.repeat_until >= $4::date)
              AND EXISTS (
                SELECT 1
                FROM generate_series(date_trunc('day', $4::timestamptz), date_trunc('day', $5::timestamptz), interval '1 day') d
                WHERE extract(dow FROM d) = ANY(o.repeat_weekdays)
                  AND ${recurringAvailabilityRange("o")} && tstzrange($4::timestamptz, $5::timestamptz, '[)')
              )
            )
          )
      )
    )
  `;
  const baseQuery = `
    SELECT
      id,
      title,
      address,
      price_per_day,
      price_per_hour,
      price_per_month,
      rate_type,
      rating,
      rating_count,
      availability_text,
      capacity,
      (${availabilityCheck}) AS is_available,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_m
    FROM listings
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND status <> 'archived'
    AND is_active = TRUE
    AND ($6::text IS NULL OR lower(title) LIKE $6 OR lower(availability_text) LIKE $6 OR EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) LIKE $6))
    AND ($7::numeric IS NULL OR price_per_day >= $7)
    AND ($8::numeric IS NULL OR price_per_day <= $8)
    AND ($9::boolean IS NOT TRUE OR EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) IN ('covered', 'garage', 'indoor')))
    AND ($10::boolean IS NOT TRUE OR EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) IN ('ev_charging', 'ev charging', 'ev')))
    AND (
      $11::text IS NULL
      OR $11::text = 'basic'
      OR ($11::text = 'cctv' AND EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) = 'cctv'))
      OR ($11::text = 'gated' AND (
        EXISTS (SELECT 1 FROM unnest(COALESCE(amenities, '{}')) amenity WHERE lower(amenity) IN ('gated', 'security'))
        OR lower(title) LIKE '%gated%'
        OR lower(title) LIKE '%secure%'
      ))
    )
    AND ($12::int IS NULL OR COALESCE(capacity, 1) >= $12)
    AND ($13::boolean IS NOT TRUE OR (${availabilityCheck}))
    AND ($14::text <> 'monthly' OR price_per_month IS NOT NULL)
    AND ($15::uuid IS NULL OR host_id != $15)
    ORDER BY distance_m ASC
    LIMIT 200;
  `;

  const legacyQuery = `
    SELECT
      id,
      title,
      address,
      price_per_day,
      rating,
      rating_count,
      availability_text,
      (${availabilityCheck}) AS is_available,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_m
    FROM listings
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND ($6::text IS NULL OR lower(title) LIKE $6)
    AND ($7::numeric IS NULL OR price_per_day >= $7)
    AND ($8::numeric IS NULL OR price_per_day <= $8)
    AND ($9::uuid IS NULL OR host_id != $9)
    ORDER BY distance_m ASC
    LIMIT 200;

  `;

  const params = [
    lng,
    lat,
    radiusKm * 1000,
    from,
    to,
    spaceTypeFilter,
    priceMin ?? null,
    priceMax ?? null,
    coveredParking === true,
    evCharging === true,
    securityLevel ?? null,
    minCapacity,
    instantBook === true,
    mode,
    excludeHostId ?? null,
  ];
  const legacyParams = [
    lng,
    lat,
    radiusKm * 1000,
    from,
    to,
    spaceTypeFilter,
    priceMin ?? null,
    priceMax ?? null,
    excludeHostId ?? null,
  ];
  try {
    const result = await pool.query(
      baseQuery.replace(
        "availability_text,",
        "availability_text, image_urls, amenities,"
      ),
      params
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      address: row.address,
      ...mapListingPricing(row),
      rating: row.rating != null ? Number(row.rating) : null,
      ratingCount: Number(row.rating_count ?? 0),
      availability: row.availability_text,
      imageUrls: row.image_urls ?? [],
      amenities: row.amenities ?? [],
      capacity: row.capacity != null ? Number(row.capacity) : 1,
      distanceKm: Math.round((row.distance_m / 1000) * 10) / 10,
      latitude: row.latitude,
      longitude: row.longitude,
      isAvailable: row.is_available,
    }));
  } catch (err: any) {
    if (err?.code !== "42703" && err?.code !== "42P01") throw err;
    const legacy = legacyQuery.replace("rating_count,", "");
    const result = await pool.query(legacy, legacyParams);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      address: row.address,
      ...mapListingPricing(row),
      rating: row.rating != null ? Number(row.rating) : null,
      ratingCount: Number(row.rating_count ?? 0),
      availability: row.availability_text,
      imageUrls: [],
      amenities: [],
      capacity: 1,
      distanceKm: Math.round((row.distance_m / 1000) * 10) / 10,
      latitude: row.latitude,
      longitude: row.longitude,
      isAvailable: row.is_available,
    }));
  }
}

export type NewListing = {
  title: string;
  address: string;
  rateType: ListingRateType;
  pricePerDay: number;
  pricePerHour?: number | null;
  pricePerMonth?: number | null;
  availabilityText: string;
  hostId: string;
  hostStripeAccountId?: string | null;
  latitude: number;
  longitude: number;
  amenities?: string[];
  imageUrls?: string[];
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  permissionDeclared?: boolean;
  capacity?: number | null;
  description?: string | null;
};

export async function createListing(listing: NewListing) {
  const query = `
    INSERT INTO listings (
      title,
      address,
      rate_type,
      price_per_day,
      price_per_hour,
      price_per_month,
      availability_text,
      host_id,
      amenities,
      geom,
      image_urls,
      access_code,
      arrival_instructions,
      permission_declared,
      capacity,
      description
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($10, $11), 4326), $12, $13, $14, $15, $16, $17)
    RETURNING id;
  `;
  const params = [
    listing.title,
    listing.address,
    listing.rateType,
    listing.pricePerDay,
    listing.pricePerHour ?? null,
    listing.pricePerMonth ?? null,
    listing.availabilityText,
    listing.hostId,
    listing.amenities ?? [],
    listing.longitude,
    listing.latitude,
    listing.imageUrls ?? [],
    listing.accessCode ?? null,
    listing.arrivalInstructions ?? null,
    listing.permissionDeclared ?? false,
    listing.capacity ?? 1,
    listing.description ?? null,
  ];
  try {
    const result = await pool.query(query, params);
    return result.rows[0];
  } catch (err: any) {
    if (err?.code !== "42703") throw err;
    const legacyQuery = `
      INSERT INTO listings (
        title,
        address,
        price_per_day,
        availability_text,
        host_id,
        amenities,
        geom,
        image_urls,
        access_code,
        permission_declared
      )
      VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), $9, $10, $11)
      RETURNING id;
    `;
    const legacyParams = [
      listing.title,
      listing.address,
      listing.pricePerDay,
      listing.availabilityText,
      listing.hostId,
      listing.amenities ?? [],
      listing.longitude,
      listing.latitude,
      listing.imageUrls ?? [],
      listing.accessCode ?? null,
      listing.permissionDeclared ?? false,
    ];
    const result = await pool.query(legacyQuery, legacyParams);
    return result.rows[0];
  }
}

export async function createBooking({
  listingId,
  driverId,
  from,
  to,
  stripePaymentIntentId,
  checkoutSessionId,
  amountCents,
  currency,
  platformFeeCents,
  payoutAvailableAt,
  vehiclePlate,
  promoCodeId,
  discountCents,
}: {
  listingId: string;
  driverId: string;
  from: string;
  to: string;
  stripePaymentIntentId: string;
  checkoutSessionId?: string | null;
  amountCents: number;
  currency: string;
  platformFeeCents: number;
  payoutAvailableAt: Date;
  vehiclePlate?: string | null;
  promoCodeId?: string | null;
  discountCents?: number;
}) {
  const insertWithStatus = `
    INSERT INTO bookings (
      listing_id,
      driver_id,
      start_time,
      end_time,
      payment_intent_id,
      checkout_session_id,
      amount_cents,
      currency,
      status,
      platform_fee_cents,
      payout_available_at,
      payout_status,
      vehicle_plate,
      promo_code_id,
      discount_cents
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, 'pending', $11, $12, $13)
    RETURNING id;
  `;
  try {
    const result = await pool.query(insertWithStatus, [
      listingId,
      driverId,
      from,
      to,
      stripePaymentIntentId,
      checkoutSessionId ?? null,
      amountCents,
      currency,
      platformFeeCents,
      payoutAvailableAt,
      vehiclePlate ?? null,
      promoCodeId ?? null,
      discountCents ?? 0,
    ]);
    return result.rows[0];
  } catch (err: any) {
    // Fallback for databases that haven't run migration 002 yet.
    if (err?.code === "42703") {
      console.warn("bookings table missing newer columns; inserting with legacy schema. Run migration 002_booking_status.sql.");
      const legacyQuery = `
        INSERT INTO bookings (listing_id, driver_id, start_time, end_time, payment_intent_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `;
      const result = await pool.query(legacyQuery, [listingId, driverId, from, to, stripePaymentIntentId]);
      return result.rows[0];
    }
    throw err;
  }
}

export async function createUser({
  email,
  fullName,
  phone,
  passwordHash,
  role = "driver",
  verificationToken,
  verificationExpires,
  phoneVerificationToken,
  phoneVerificationExpires,
  termsVersion,
  privacyVersion,
}: {
  email: string;
  fullName?: string | null;
  phone?: string | null;
  passwordHash: string;
  role?: UserRecord["role"];
  verificationToken?: string | null;
  verificationExpires?: Date | null;
  phoneVerificationToken?: string | null;
  phoneVerificationExpires?: Date | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
}) {
  const now = new Date();
  const query = `
    INSERT INTO users (
      email,
      full_name,
      phone,
      password_hash,
      role,
      verification_token,
      verification_expires,
      phone_verification_token,
      phone_verification_expires,
      terms_version,
      terms_accepted_at,
      privacy_version,
      privacy_accepted_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, full_name, phone, phone_verified, role, password_hash, host_stripe_account_id, email_verified,
      vehicle_make, vehicle_type, vehicle_color, vehicle_plate, status,
      verification_token, verification_expires, phone_verification_token, phone_verification_expires,
      terms_version, terms_accepted_at, privacy_version, privacy_accepted_at;
  `;
  const result = await pool.query(query, [
    email.toLowerCase(),
    fullName ?? null,
    phone ?? null,
    passwordHash,
    role,
    verificationToken ?? null,
    verificationExpires ?? null,
    phoneVerificationToken ?? null,
    phoneVerificationExpires ?? null,
    termsVersion ?? null,
    termsVersion ? now : null,
    privacyVersion ?? null,
    privacyVersion ? now : null,
  ]);
  return result.rows[0] as UserRecord | undefined;
}

export async function findUserByEmail(email: string) {
  const result = await pool.query(
    `SELECT id, email, full_name, phone, phone_verified, password_hash, role, host_stripe_account_id, email_verified, vehicle_make, vehicle_type, vehicle_color, vehicle_plate, status, verification_token,
      verification_expires, phone_verification_token, phone_verification_expires, refresh_token_hash, refresh_expires, terms_version, terms_accepted_at,
      privacy_version, privacy_accepted_at
     FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function findUserById(userId: string) {
  const result = await pool.query(
    `SELECT id, email, full_name, phone, phone_verified, password_hash, role, host_stripe_account_id, email_verified, vehicle_make, vehicle_type, vehicle_color, vehicle_plate, status, verification_token,
      verification_expires, phone_verification_token, phone_verification_expires, refresh_token_hash, refresh_expires, terms_version, terms_accepted_at,
      privacy_version, privacy_accepted_at
     FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function findUserByResetToken(token: string) {
  const result = await pool.query(
    `
    SELECT id, email, password_hash, role, host_stripe_account_id, status
    FROM users
    WHERE reset_token = $1 AND (reset_expires IS NULL OR reset_expires > now())
    LIMIT 1
    `,
    [token]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function verifyUserEmail(token: string) {
  const result = await pool.query(
    `
    UPDATE users
    SET email_verified = true, verification_token = null, verification_expires = null
    WHERE verification_token = $1 AND (verification_expires IS NULL OR verification_expires > now())
    RETURNING id, email, role, host_stripe_account_id;
    `,
    [token]
  );
  return result.rows[0] as Pick<UserRecord, "id" | "email" | "role" | "host_stripe_account_id"> | undefined;
}

export async function setVerificationToken(userId: string, token: string, expiresAt: Date) {
  await pool.query(
    `
    UPDATE users
    SET verification_token = $1, verification_expires = $2
    WHERE id = $3
    `,
    [token, expiresAt, userId]
  );
}

export async function setPhoneVerificationToken(userId: string, token: string, expiresAt: Date) {
  await pool.query(
    `
    UPDATE users
    SET phone_verification_token = $1, phone_verification_expires = $2, phone_verified = false
    WHERE id = $3
    `,
    [token, expiresAt, userId]
  );
}

export async function verifyUserPhone(userId: string, token: string) {
  const result = await pool.query(
    `
    UPDATE users
    SET phone_verified = true, phone_verification_token = null, phone_verification_expires = null
    WHERE id = $1
      AND phone_verification_token = $2
      AND (phone_verification_expires IS NULL OR phone_verification_expires > now())
    RETURNING id, email, full_name, phone, phone_verified, role, host_stripe_account_id, email_verified,
      vehicle_make, vehicle_type, vehicle_color, vehicle_plate;
    `,
    [userId, token]
  );
  return result.rows[0] as Pick<
    UserRecord,
    "id" | "email" | "full_name" | "phone" | "phone_verified" | "role" | "host_stripe_account_id"
  > & { email_verified: boolean } | undefined;
}

export async function setPasswordResetToken(userId: string, token: string, expiresAt: Date) {
  await pool.query(
    `
    UPDATE users
    SET reset_token = $1, reset_expires = $2
    WHERE id = $3
    `,
    [token, expiresAt, userId]
  );
}

export async function setRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
  await pool.query(
    `
    UPDATE users
    SET refresh_token_hash = $1, refresh_expires = $2
    WHERE id = $3
    `,
    [tokenHash, expiresAt, userId]
  );
}

export async function clearRefreshToken(userId: string) {
  await pool.query(
    `
    UPDATE users
    SET refresh_token_hash = null, refresh_expires = null
    WHERE id = $1
    `,
    [userId]
  );
}

export async function findUserByRefreshTokenHash(tokenHash: string) {
  const result = await pool.query(
    `
    SELECT id, email, full_name, phone, phone_verified, role, host_stripe_account_id, email_verified, vehicle_make, vehicle_type, vehicle_color, vehicle_plate, status, refresh_token_hash, refresh_expires,
      terms_version, terms_accepted_at, privacy_version, privacy_accepted_at
    FROM users
    WHERE refresh_token_hash = $1
      AND (refresh_expires IS NULL OR refresh_expires > now())
    LIMIT 1
    `,
    [tokenHash]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function setLegalAcceptance({
  userId,
  termsVersion,
  privacyVersion,
}: {
  userId: string;
  termsVersion?: string | null;
  privacyVersion?: string | null;
}) {
  const now = new Date();
  const result = await pool.query(
    `
    UPDATE users
    SET terms_version = COALESCE($2, terms_version),
        terms_accepted_at = CASE WHEN $2 IS NOT NULL THEN $4 ELSE terms_accepted_at END,
        privacy_version = COALESCE($3, privacy_version),
        privacy_accepted_at = CASE WHEN $3 IS NOT NULL THEN $4 ELSE privacy_accepted_at END
    WHERE id = $1
    RETURNING id, email, full_name, phone, role, host_stripe_account_id, email_verified, vehicle_make, vehicle_type, vehicle_color, vehicle_plate, terms_version, terms_accepted_at,
      privacy_version, privacy_accepted_at;
    `,
    [userId, termsVersion ?? null, privacyVersion ?? null, now]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  const result = await pool.query(
    `
    UPDATE users
    SET password_hash = $1, reset_token = null, reset_expires = null
    WHERE id = $2
    RETURNING id, email, role, host_stripe_account_id
    `,
    [passwordHash, userId]
  );
  return result.rows[0] as Pick<UserRecord, "id" | "email" | "role" | "host_stripe_account_id"> | undefined;
}

export async function setEmailVerified(userId: string, verified: boolean) {
  const result = await pool.query(
    `
    UPDATE users
    SET email_verified = $1, verification_token = null, verification_expires = null
    WHERE id = $2
    RETURNING id, email, full_name, phone, phone_verified, role, host_stripe_account_id, email_verified,
      vehicle_make, vehicle_type, vehicle_color, vehicle_plate;
    `,
    [verified, userId]
  );
  return result.rows[0] as Pick<
    UserRecord,
    "id" | "email" | "full_name" | "phone" | "phone_verified" | "role" | "host_stripe_account_id"
  > & { email_verified: boolean };
}

export async function updateUserProfile({
  userId,
  email,
  fullName,
  phone,
  vehicleMake,
  vehicleType,
  vehicleColor,
  vehiclePlate,
}: {
  userId: string;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  vehicleMake?: string | null;
  vehicleType?: string | null;
  vehicleColor?: string | null;
  vehiclePlate?: string | null;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (email !== undefined) {
    fields.push(`email = $${idx++}`);
    values.push(email);
    fields.push(`email_verified = false`);
    fields.push(`verification_token = null`);
    fields.push(`verification_expires = null`);
  }
  if (fullName !== undefined) {
    fields.push(`full_name = $${idx++}`);
    values.push(fullName);
  }
  if (phone !== undefined) {
    fields.push(`phone = $${idx++}`);
    values.push(phone);
  }
  if (vehicleMake !== undefined) {
    fields.push(`vehicle_make = $${idx++}`);
    values.push(vehicleMake);
  }
  if (vehicleType !== undefined) {
    fields.push(`vehicle_type = $${idx++}`);
    values.push(vehicleType);
  }
  if (vehicleColor !== undefined) {
    fields.push(`vehicle_color = $${idx++}`);
    values.push(vehicleColor);
  }
  if (vehiclePlate !== undefined) {
    fields.push(`vehicle_plate = $${idx++}`);
    values.push(vehiclePlate);
  }
  if (!fields.length) return undefined;

  values.push(userId);
  const result = await pool.query(
    `
    UPDATE users
    SET ${fields.join(", ")}
    WHERE id = $${idx}
    RETURNING id, email, full_name, phone, phone_verified, password_hash, role, host_stripe_account_id, email_verified,
      vehicle_make, vehicle_type, vehicle_color, vehicle_plate,
      verification_token, verification_expires, phone_verification_token, phone_verification_expires, refresh_token_hash, refresh_expires,
      terms_version, terms_accepted_at, privacy_version, privacy_accepted_at
    `,
    values
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function listListingsByHost(hostId: string) {
  let result;
  try {
    result = await pool.query(
      `
      SELECT
        id,
        title,
        address,
        price_per_day,
        price_per_hour,
        price_per_month,
        rate_type,
        availability_text,
        image_urls,
        access_code,
        arrival_instructions,
        is_active,
        ST_X(geom) AS longitude,
        ST_Y(geom) AS latitude
      FROM listings
      WHERE host_id = $1
        AND status <> 'archived'
      ORDER BY created_at DESC
      `,
      [hostId]
    );
  } catch (err: any) {
    if (err?.code !== "42703") throw err;
    result = await pool.query(
      `
      SELECT
        id,
        title,
        address,
        price_per_day,
        availability_text,
        image_urls,
        access_code,
        ST_X(geom) AS longitude,
        ST_Y(geom) AS latitude
      FROM listings
      WHERE host_id = $1
        AND status <> 'archived'
      ORDER BY created_at DESC
      `,
      [hostId]
    );
  }
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    address: row.address,
    ...mapListingPricing(row),
    availability: row.availability_text,
    imageUrls: row.image_urls ?? [],
    accessCode: row.access_code ?? null,
    arrivalInstructions: row.arrival_instructions ?? null,
    isActive: row.is_active ?? true,
    longitude: row.longitude,
    latitude: row.latitude,
  }));
}

export async function deleteListing({ listingId, hostId }: { listingId: string; hostId: string }) {
  const result = await pool.query(
    `
    UPDATE listings
    SET status = 'archived'
    WHERE id = $1 AND host_id = $2
    RETURNING id;
    `,
    [listingId, hostId]
  );
  return result.rowCount && result.rowCount > 0;
}

export async function getListingHostId(listingId: string) {
  const res = await pool.query(`SELECT host_id FROM listings WHERE id = $1 LIMIT 1`, [listingId]);
  return res.rows[0]?.host_id as string | undefined;
}

export async function updateListingForHost({
  listingId,
  hostId,
  title,
  address,
  pricePerDay,
  pricePerHour,
  pricePerMonth,
  rateType,
  availabilityText,
  latitude,
  longitude,
  imageUrls,
  amenities,
  accessCode,
  arrivalInstructions,
  permissionDeclared,
  capacity,
  isActive,
  description,
}: {
  listingId: string;
  hostId: string;
  title?: string;
  address?: string;
  pricePerDay?: number;
  pricePerHour?: number | null;
  pricePerMonth?: number | null;
  rateType?: ListingRateType;
  availabilityText?: string;
  latitude?: number;
  longitude?: number;
  imageUrls?: string[];
  amenities?: string[];
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  permissionDeclared?: boolean;
  capacity?: number | null;
  isActive?: boolean;
  description?: string | null;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (typeof title === "string") {
    fields.push(`title = $${idx++}`);
    values.push(title);
  }
  if (typeof address === "string") {
    fields.push(`address = $${idx++}`);
    values.push(address);
  }
  if (typeof rateType === "string") {
    fields.push(`rate_type = $${idx++}`);
    values.push(rateType);
  }
  if (typeof pricePerDay === "number") {
    fields.push(`price_per_day = $${idx++}`);
    values.push(pricePerDay);
  }
  if (pricePerHour !== undefined) {
    fields.push(`price_per_hour = $${idx++}`);
    values.push(pricePerHour);
  }
  if (pricePerMonth !== undefined) {
    fields.push(`price_per_month = $${idx++}`);
    values.push(pricePerMonth);
  }
  if (typeof availabilityText === "string") {
    fields.push(`availability_text = $${idx++}`);
    values.push(availabilityText);
  }
  if (Array.isArray(imageUrls)) {
    fields.push(`image_urls = $${idx++}`);
    values.push(imageUrls);
  }
  if (Array.isArray(amenities)) {
    fields.push(`amenities = $${idx++}`);
    values.push(amenities);
  }
  if (accessCode !== undefined) {
    fields.push(`access_code = $${idx++}`);
    values.push(accessCode ? accessCode.trim() : null);
  }
  if (arrivalInstructions !== undefined) {
    fields.push(`arrival_instructions = $${idx++}`);
    values.push(arrivalInstructions ? arrivalInstructions.trim() : null);
  }
  if (typeof permissionDeclared === "boolean") {
    fields.push(`permission_declared = $${idx++}`);
    values.push(permissionDeclared);
  }
  if (typeof capacity === "number" && capacity >= 1) {
    fields.push(`capacity = $${idx++}`);
    values.push(Math.min(20, Math.floor(capacity)));
  }
  if (typeof isActive === "boolean") {
    fields.push(`is_active = $${idx++}`);
    values.push(isActive);
  }
  if (description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(description ? description.trim() : null);
  }
  if (typeof latitude === "number" && typeof longitude === "number") {
    fields.push(`geom = ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)`);
    values.push(longitude, latitude);
  }

  if (!fields.length) return null;
  values.push(listingId, hostId);
  try {
    const result = await pool.query(
      `
      UPDATE listings
      SET ${fields.join(", ")}
      WHERE id = $${idx++} AND host_id = $${idx}
      RETURNING id;
      `,
      values
    );
    return result.rowCount ? result.rows[0] : null;
  } catch (err: any) {
    if (err?.code !== "42703") throw err;
    const legacyFields: string[] = [];
    const legacyValues: any[] = [];
    let legacyIdx = 1;
    if (typeof title === "string") {
      legacyFields.push(`title = $${legacyIdx++}`);
      legacyValues.push(title);
    }
    if (typeof address === "string") {
      legacyFields.push(`address = $${legacyIdx++}`);
      legacyValues.push(address);
    }
    if (typeof pricePerDay === "number") {
      legacyFields.push(`price_per_day = $${legacyIdx++}`);
      legacyValues.push(pricePerDay);
    }
    if (typeof availabilityText === "string") {
      legacyFields.push(`availability_text = $${legacyIdx++}`);
      legacyValues.push(availabilityText);
    }
    if (Array.isArray(imageUrls)) {
      legacyFields.push(`image_urls = $${legacyIdx++}`);
      legacyValues.push(imageUrls);
    }
    if (Array.isArray(amenities)) {
      legacyFields.push(`amenities = $${legacyIdx++}`);
      legacyValues.push(amenities);
    }
    if (accessCode !== undefined) {
      legacyFields.push(`access_code = $${legacyIdx++}`);
      legacyValues.push(accessCode ? accessCode.trim() : null);
    }
    if (typeof permissionDeclared === "boolean") {
      legacyFields.push(`permission_declared = $${legacyIdx++}`);
      legacyValues.push(permissionDeclared);
    }
    if (typeof latitude === "number" && typeof longitude === "number") {
      legacyFields.push(`geom = ST_SetSRID(ST_MakePoint($${legacyIdx++}, $${legacyIdx++}), 4326)`);
      legacyValues.push(longitude, latitude);
    }
    if (!legacyFields.length) return null;
    legacyValues.push(listingId, hostId);
    const legacyResult = await pool.query(
      `
      UPDATE listings
      SET ${legacyFields.join(", ")}
      WHERE id = $${legacyIdx++} AND host_id = $${legacyIdx}
      RETURNING id;
      `,
      legacyValues
    );
    return legacyResult.rowCount ? legacyResult.rows[0] : null;
  }
}

export async function getListingById(listingId: string) {
  let result;
  try {
    result = await pool.query(
      `
      SELECT
        id,
        title,
        address,
        price_per_day,
        price_per_hour,
        price_per_month,
        rate_type,
        availability_text,
        image_urls,
        amenities,
        access_code,
        arrival_instructions,
        permission_declared,
        host_id,
        rating,
        rating_count,
        capacity,
        description,
        ST_X(geom) AS longitude,
        ST_Y(geom) AS latitude
      FROM listings
      WHERE id = $1
        AND status <> 'archived'
      LIMIT 1
      `,
      [listingId]
    );
  } catch (err: any) {
    if (err?.code !== "42703") throw err;
    result = await pool.query(
      `
      SELECT
        id,
        title,
        address,
        price_per_day,
        availability_text,
        image_urls,
        amenities,
        access_code,
        permission_declared,
        host_id,
        rating,
        rating_count,
        ST_X(geom) AS longitude,
        ST_Y(geom) AS latitude
      FROM listings
      WHERE id = $1
        AND status <> 'archived'
      LIMIT 1
      `,
      [listingId]
    );
  }

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    address: row.address,
    ...mapListingPricing(row),
    availability: row.availability_text,
    amenities: row.amenities ?? [],
    imageUrls: row.image_urls ?? [],
    accessCode: row.access_code ?? null,
    arrivalInstructions: row.arrival_instructions ?? null,
    permissionDeclared: row.permission_declared ?? false,
    hostId: row.host_id,
    rating: row.rating != null ? Number(row.rating) : null,
    ratingCount: Number(row.rating_count ?? 0),
    capacity: row.capacity != null ? Number(row.capacity) : 1,
    description: row.description ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export async function getListingByIdWithAvailability(
  listingId: string,
  from: string,
  to: string
) {
  const availabilityCheck = `
    NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.listing_id = listings.id
      AND (b.status IS NULL OR b.status <> 'canceled')
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM listing_availability a
      WHERE a.listing_id = listings.id
        AND a.kind = 'blocked'
        AND (
          (a.repeat_weekdays IS NULL AND ${oneOffAvailabilityRange("a")} && tstzrange($2::timestamptz, $3::timestamptz, '[)'))
          OR (
            a.repeat_weekdays IS NOT NULL
            AND (a.repeat_until IS NULL OR a.repeat_until >= $2::date)
            AND EXISTS (
              SELECT 1
              FROM generate_series(date_trunc('day', $2::timestamptz), date_trunc('day', $3::timestamptz), interval '1 day') d
              WHERE extract(dow FROM d) = ANY(a.repeat_weekdays)
                AND ${recurringAvailabilityRange("a")} && tstzrange($2::timestamptz, $3::timestamptz, '[)')
            )
          )
        )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM listing_availability o WHERE o.listing_id = listings.id AND o.kind = 'open')
      OR EXISTS (
        SELECT 1 FROM listing_availability o
        WHERE o.listing_id = listings.id
          AND o.kind = 'open'
          AND (
            (o.repeat_weekdays IS NULL AND ${oneOffAvailabilityRange("o")} && tstzrange($2::timestamptz, $3::timestamptz, '[)'))
            OR (
              o.repeat_weekdays IS NOT NULL
              AND (o.repeat_until IS NULL OR o.repeat_until >= $2::date)
              AND EXISTS (
                SELECT 1
                FROM generate_series(date_trunc('day', $2::timestamptz), date_trunc('day', $3::timestamptz), interval '1 day') d
                WHERE extract(dow FROM d) = ANY(o.repeat_weekdays)
                  AND ${recurringAvailabilityRange("o")} && tstzrange($2::timestamptz, $3::timestamptz, '[)')
              )
            )
          )
      )
    )
  `;
  let result;
  try {
    result = await pool.query(
      `
      SELECT
        id,
        title,
        address,
        price_per_day,
        price_per_hour,
        price_per_month,
        rate_type,
        availability_text,
        image_urls,
        amenities,
        access_code,
        arrival_instructions,
        permission_declared,
        host_id,
        rating,
        rating_count,
        capacity,
        description,
        (${availabilityCheck}) AS is_available,
        ST_X(geom) AS longitude,
        ST_Y(geom) AS latitude
      FROM listings
      WHERE id = $1
        AND status <> 'archived'
      LIMIT 1
      `,
      [listingId, from, to]
    );
  } catch (err: any) {
    if (err?.code !== "42703") throw err;
    result = await pool.query(
      `
      SELECT
        id,
        title,
        address,
        price_per_day,
        availability_text,
        image_urls,
        amenities,
        access_code,
        permission_declared,
        host_id,
        rating,
        rating_count,
        (${availabilityCheck}) AS is_available,
        ST_X(geom) AS longitude,
        ST_Y(geom) AS latitude
      FROM listings
      WHERE id = $1
        AND status <> 'archived'
      LIMIT 1
      `,
      [listingId, from, to]
    );
  }

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    address: row.address,
    ...mapListingPricing(row),
    availability: row.availability_text,
    amenities: row.amenities ?? [],
    imageUrls: row.image_urls ?? [],
    accessCode: row.access_code ?? null,
    arrivalInstructions: row.arrival_instructions ?? null,
    permissionDeclared: row.permission_declared ?? false,
    hostId: row.host_id,
    rating: row.rating != null ? Number(row.rating) : null,
    ratingCount: Number(row.rating_count ?? 0),
    capacity: row.capacity != null ? Number(row.capacity) : 1,
    description: row.description ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    isAvailable: row.is_available,
  };
}

export async function setListingDescription(listingId: string, description: string) {
  await pool.query(
    `UPDATE listings SET description = $2 WHERE id = $1`,
    [listingId, description]
  );
}

export async function addFavorite(userId: string, listingId: string) {
  const result = await pool.query(
    `
    INSERT INTO favorites (user_id, listing_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    RETURNING listing_id;
    `,
    [userId, listingId]
  );
  return result.rowCount ? result.rows[0].listing_id : null;
}

export async function removeFavorite(userId: string, listingId: string) {
  const result = await pool.query(
    `
    DELETE FROM favorites
    WHERE user_id = $1 AND listing_id = $2
    `,
    [userId, listingId]
  );
  return result.rowCount ? true : false;
}

export async function listFavoritesByUser(userId: string) {
  const result = await pool.query(
    `
    SELECT
      l.id,
      l.title,
      l.address,
      l.price_per_day,
      l.price_per_hour,
      l.rate_type,
      l.availability_text,
      l.amenities,
      l.rating,
      l.rating_count,
      l.image_urls,
      ST_X(l.geom) AS longitude,
      ST_Y(l.geom) AS latitude
    FROM favorites f
    JOIN listings l ON l.id = f.listing_id
    WHERE f.user_id = $1
      AND l.status <> 'archived'
    ORDER BY f.created_at DESC
    `,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    address: row.address,
    ...mapListingPricing(row),
    availability: row.availability_text,
    amenities: row.amenities ?? [],
    imageUrls: row.image_urls ?? [],
    rating: row.rating,
    ratingCount: row.rating_count,
    longitude: row.longitude,
    latitude: row.latitude,
  }));
}

export async function upsertPushToken({
  userId,
  expoToken,
  platform,
  deviceId,
}: {
  userId: string;
  expoToken: string;
  platform: string;
  deviceId?: string | null;
}) {
  const res = await pool.query(
    `
    INSERT INTO push_tokens (user_id, expo_token, platform, device_id, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (expo_token)
    DO UPDATE SET user_id = EXCLUDED.user_id,
                  platform = EXCLUDED.platform,
                  device_id = EXCLUDED.device_id,
                  updated_at = NOW()
    RETURNING id;
    `,
    [userId, expoToken, platform, deviceId ?? null]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function deletePushToken({
  userId,
  expoToken,
}: {
  userId: string;
  expoToken: string;
}) {
  const res = await pool.query(
    `
    DELETE FROM push_tokens
    WHERE user_id = $1 AND expo_token = $2
    `,
    [userId, expoToken]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listPushTokensByUserIds(userIds: string[]) {
  if (!userIds.length) return [];
  const res = await pool.query(
    `
    SELECT user_id, expo_token, platform
    FROM push_tokens
    WHERE user_id = ANY($1)
    `,
    [userIds]
  );
  return res.rows as { user_id: string; expo_token: string; platform: string }[];
}

export async function getPushTokenStats(userId: string) {
  const res = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total_tokens,
      COUNT(DISTINCT device_id) FILTER (WHERE device_id IS NOT NULL)::int AS total_devices
    FROM push_tokens
    WHERE user_id = $1
    `,
    [userId]
  );
  return res.rows[0] as { total_tokens: number; total_devices: number };
}

export async function hasPushToken(userId: string, expoToken: string) {
  const res = await pool.query(
    `
    SELECT 1
    FROM push_tokens
    WHERE user_id = $1 AND expo_token = $2
    LIMIT 1
    `,
    [userId, expoToken]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getBookingNotificationTargetsByPaymentIntent(paymentIntentId: string) {
  const res = await pool.query(
    `
    SELECT b.id AS booking_id,
           b.driver_id,
           l.host_id,
           l.title AS listing_title,
           l.address AS listing_address,
           l.access_code,
           l.arrival_instructions,
           driver.email AS driver_email,
           b.start_time,
           b.end_time,
           b.amount_cents,
           b.vehicle_plate
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    LEFT JOIN users driver ON driver.id = b.driver_id
    WHERE b.payment_intent_id = $1
    LIMIT 1;
    `,
    [paymentIntentId]
  );
  return res.rows[0] as
    | {
        booking_id: string;
        driver_id: string;
        host_id: string;
        listing_title: string;
        listing_address: string;
        access_code: string | null;
        arrival_instructions: string | null;
        driver_email: string | null;
        start_time: Date;
        end_time: Date;
        amount_cents: number | null;
        vehicle_plate: string | null;
      }
    | undefined;
}

export async function getBookingNotificationTargetsByCheckoutSession(checkoutSessionId: string) {
  const res = await pool.query(
    `
    SELECT b.id AS booking_id,
           b.driver_id,
           l.host_id,
           l.title AS listing_title,
           l.address AS listing_address,
           l.access_code,
           l.arrival_instructions,
           driver.email AS driver_email,
           b.start_time,
           b.end_time,
           b.amount_cents,
           b.vehicle_plate
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    LEFT JOIN users driver ON driver.id = b.driver_id
    WHERE b.checkout_session_id = $1
    LIMIT 1;
    `,
    [checkoutSessionId]
  );
  return res.rows[0] as
    | {
        booking_id: string;
        driver_id: string;
        host_id: string;
        listing_title: string;
        listing_address: string;
        access_code: string | null;
        arrival_instructions: string | null;
        driver_email: string | null;
        start_time: Date;
        end_time: Date;
        amount_cents: number | null;
        vehicle_plate: string | null;
      }
    | undefined;
}

export async function getBookingNotificationTargets(bookingId: string) {
  const res = await pool.query(
    `
    SELECT b.id AS booking_id,
           b.driver_id,
           l.host_id,
           l.title AS listing_title,
           l.address AS listing_address,
           l.access_code,
           l.arrival_instructions,
           driver.email AS driver_email,
           b.start_time,
           b.end_time,
           b.amount_cents,
           b.vehicle_plate
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    LEFT JOIN users driver ON driver.id = b.driver_id
    WHERE b.id = $1
    LIMIT 1;
    `,
    [bookingId]
  );
  return res.rows[0] as
    | {
        booking_id: string;
        driver_id: string;
        host_id: string;
        listing_title: string;
        listing_address: string;
        access_code: string | null;
        arrival_instructions: string | null;
        driver_email: string | null;
        start_time: Date;
        end_time: Date;
        amount_cents: number | null;
        vehicle_plate: string | null;
      }
    | undefined;
}

export async function insertScheduledNotification({
  userId,
  bookingId,
  type,
  scheduledAt,
  payload,
}: {
  userId: string;
  bookingId: string | null;
  type: string;
  scheduledAt: Date;
  payload?: Record<string, unknown> | null;
}) {
  const res = await pool.query(
    `
    INSERT INTO scheduled_notifications (user_id, booking_id, type, scheduled_at, payload)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (booking_id, type) DO UPDATE
      SET scheduled_at = EXCLUDED.scheduled_at,
          payload = EXCLUDED.payload
    RETURNING id;
    `,
    [userId, bookingId, type, scheduledAt, payload ?? null]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listDueScheduledNotifications(limit = 50) {
  const res = await pool.query(
    `
    SELECT sn.id, sn.user_id, sn.booking_id, sn.type, sn.scheduled_at, sn.payload,
           l.title AS listing_title
    FROM scheduled_notifications sn
    LEFT JOIN bookings b ON b.id = sn.booking_id
    LEFT JOIN listings l ON l.id = b.listing_id
    WHERE sn.sent_at IS NULL
      AND sn.scheduled_at <= NOW()
    ORDER BY sn.scheduled_at ASC
    LIMIT $1;
    `,
    [limit]
  );
  return res.rows as {
    id: string;
    user_id: string;
    booking_id: string | null;
    type: string;
    scheduled_at: Date;
    payload: Record<string, unknown> | null;
    listing_title: string | null;
  }[];
}

export async function markScheduledNotificationSent(id: string) {
  const res = await pool.query(
    `
    UPDATE scheduled_notifications
    SET sent_at = NOW()
    WHERE id = $1
    `,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function deleteScheduledNotificationsByBooking(bookingId: string) {
  const res = await pool.query(
    `
    DELETE FROM scheduled_notifications
    WHERE booking_id = $1
    `,
    [bookingId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getListingWithHostAccount(listingId: string) {
  const result = await pool.query(
    `
    SELECT
      l.id,
      l.title,
      l.address,
      l.price_per_day,
      l.price_per_hour,
      l.rate_type,
      l.availability_text,
      l.amenities,
      l.host_id,
      l.rating,
      l.rating_count,
      l.image_urls,
      l.capacity,
      ST_X(l.geom) AS longitude,
      ST_Y(l.geom) AS latitude,
      u.host_stripe_account_id
    FROM listings l
    JOIN users u ON u.id = l.host_id
    WHERE l.id = $1
      AND l.status <> 'archived'
      AND l.is_active = TRUE
    LIMIT 1
    `,
    [listingId]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    address: row.address,
    ...mapListingPricing(row),
    availability: row.availability_text,
    amenities: row.amenities ?? [],
    hostId: row.host_id,
    hostStripeAccountId: row.host_stripe_account_id,
    rating: row.rating != null ? Number(row.rating) : null,
    ratingCount: Number(row.rating_count ?? 0),
    imageUrls: row.image_urls ?? [],
    capacity: row.capacity != null ? Number(row.capacity) : 1,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}


export async function listAvailability(listingId: string) {
  const res = await pool.query(
    `
    SELECT id, kind, starts_at, ends_at, repeat_weekdays, repeat_until, created_at
    FROM listing_availability
    WHERE listing_id = $1
    ORDER BY starts_at ASC;
    `,
    [listingId]
  );
  return res.rows.map((row) => ({
    id: row.id,
    kind: row.kind as "open" | "blocked",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    repeatWeekdays: row.repeat_weekdays ?? [],
    repeatUntil: row.repeat_until,
    createdAt: row.created_at,
  }));
}

export async function createAvailabilityEntry({
  listingId,
  kind,
  startsAt,
  endsAt,
  repeatWeekdays,
  repeatUntil,
}: {
  listingId: string;
  kind: "open" | "blocked";
  startsAt: string;
  endsAt: string;
  repeatWeekdays?: number[];
  repeatUntil?: string | null;
}) {
  const res = await pool.query(
    `
    INSERT INTO listing_availability (listing_id, kind, starts_at, ends_at, repeat_weekdays, repeat_until)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, kind, starts_at, ends_at, repeat_weekdays, repeat_until, created_at;
    `,
    [listingId, kind, startsAt, endsAt, repeatWeekdays ?? null, repeatUntil ?? null]
  );
  const row = res.rows[0];
  return {
    id: row.id,
    kind: row.kind as "open" | "blocked",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    repeatWeekdays: row.repeat_weekdays ?? [],
    repeatUntil: row.repeat_until,
    createdAt: row.created_at,
  };
}

export async function deleteAvailabilityEntry({ id, hostId }: { id: string; hostId: string }) {
  const res = await pool.query(
    `
    DELETE FROM listing_availability la
    USING listings l
    WHERE la.id = $1
      AND la.listing_id = l.id
      AND l.host_id = $2
    RETURNING la.id;
    `,
    [id, hostId]
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function updateAvailabilityEntry({
  id,
  hostId,
  kind,
  startsAt,
  endsAt,
  repeatWeekdays,
  repeatUntil,
}: {
  id: string;
  hostId: string;
  kind?: "open" | "blocked";
  startsAt?: string;
  endsAt?: string;
  repeatWeekdays?: number[] | null;
  repeatUntil?: string | null;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (kind) {
    fields.push(`kind = $${idx++}`);
    values.push(kind);
  }
  if (startsAt) {
    fields.push(`starts_at = $${idx++}`);
    values.push(startsAt);
  }
  if (endsAt) {
    fields.push(`ends_at = $${idx++}`);
    values.push(endsAt);
  }
  if (repeatWeekdays !== undefined) {
    fields.push(`repeat_weekdays = $${idx++}`);
    values.push(repeatWeekdays ?? null);
  }
  if (repeatUntil !== undefined) {
    fields.push(`repeat_until = $${idx++}`);
    values.push(repeatUntil ?? null);
  }

  if (fields.length === 0) return null;

  const query = `
    UPDATE listing_availability la
    SET ${fields.join(", ")}
    FROM listings l
    WHERE la.id = $${idx}
      AND la.listing_id = l.id
      AND l.host_id = $${idx + 1}
    RETURNING la.id, la.kind, la.starts_at, la.ends_at, la.repeat_weekdays, la.repeat_until, la.listing_id, la.created_at;
  `;
  values.push(id, hostId);

  const res = await pool.query(query, values);
  if (!res.rowCount) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    kind: row.kind as "open" | "blocked",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    repeatWeekdays: row.repeat_weekdays ?? [],
    repeatUntil: row.repeat_until,
    listingId: row.listing_id,
    createdAt: row.created_at,
  };
}

export async function updateBookingStatus({
  checkoutSessionId,
  status,
  paymentIntentId,
  receiptUrl,
}: {
  checkoutSessionId: string;
  status: "confirmed" | "canceled";
  paymentIntentId?: string;
  receiptUrl?: string | null;
}) {
  try {
    const result = await pool.query(
      `
      UPDATE bookings
      SET status = $1::booking_status,
          payment_intent_id = COALESCE($3, payment_intent_id),
          receipt_url = COALESCE($4, receipt_url),
          payout_status = CASE
            WHEN $1 = 'confirmed' THEN COALESCE(payout_status, 'pending')
            ELSE 'canceled'
          END,
          payout_available_at = CASE
            WHEN $1 = 'confirmed' AND payout_available_at IS NULL THEN start_time + interval '24 hours'
            ELSE payout_available_at
          END
      WHERE checkout_session_id = $2
        AND (
          ($1 = 'confirmed' AND COALESCE(status::text, 'pending') = 'pending')
          OR ($1 = 'canceled' AND COALESCE(status::text, 'pending') <> 'canceled')
        )
      RETURNING id;
      `,
      [status, checkoutSessionId, paymentIntentId ?? null, receiptUrl ?? null]
    );
    return result.rowCount && result.rowCount > 0;
  } catch (err: any) {
    if (err?.code === "42703") {
      console.warn("bookings table missing status/checkout_session_id columns; webhook status update skipped. Run migration 002_booking_status.sql.");
      return false;
    }
    throw err;
  }
}

export async function updateBookingStatusByPaymentIntent({
  paymentIntentId,
  status,
  receiptUrl,
}: {
  paymentIntentId: string;
  status: "confirmed" | "canceled";
  receiptUrl?: string | null;
}) {
  try {
    const result = await pool.query(
      `
      UPDATE bookings
      SET status = $1::booking_status,
          receipt_url = COALESCE($3, receipt_url),
          payout_status = CASE
            WHEN $1 = 'confirmed' THEN COALESCE(payout_status, 'pending')
            ELSE 'canceled'
          END,
          payout_available_at = CASE
            WHEN $1 = 'confirmed' AND payout_available_at IS NULL THEN start_time + interval '24 hours'
            ELSE payout_available_at
          END
      WHERE payment_intent_id = $2
        AND (
          ($1 = 'confirmed' AND COALESCE(status::text, 'pending') = 'pending')
          OR ($1 = 'canceled' AND COALESCE(status::text, 'pending') <> 'canceled')
        )
      RETURNING id;
      `,
      [status, paymentIntentId, receiptUrl ?? null]
    );
    return result.rowCount && result.rowCount > 0;
  } catch (err: any) {
    if (err?.code === "42703") {
      console.warn("bookings table missing status/payment_intent_id columns; status update skipped. Run migration 002_booking_status.sql.");
      return false;
    }
    throw err;
  }
}

export async function markBookingRefundedByPaymentIntent({
  paymentIntentId,
  refundId,
}: {
  paymentIntentId: string;
  refundId: string;
}) {
  const result = await pool.query(
    `
    UPDATE bookings
    SET refund_status = 'succeeded',
        refund_id = $2,
        refunded_at = NOW()
    WHERE payment_intent_id = $1
    RETURNING id;
    `,
    [paymentIntentId, refundId]
  );
  return result.rowCount && result.rowCount > 0;
}

export async function insertEventLog({
  eventType,
  payload,
}: {
  eventType: string;
  payload?: Record<string, unknown> | null;
}) {
  await pool.query(
    `
    INSERT INTO event_log (event_type, payload)
    VALUES ($1, $2)
    `,
    [eventType, payload ?? null]
  );
}

export async function listEventLog({
  eventType,
  limit,
  offset,
}: {
  eventType?: string;
  limit: number;
  offset: number;
}) {
  const values: any[] = [];
  let where = "";
  if (eventType) {
    values.push(eventType);
    where = `WHERE event_type = $${values.length}`;
  }
  values.push(limit);
  values.push(offset);
  const res = await pool.query(
    `
    SELECT id, event_type, payload, created_at
    FROM event_log
    ${where}
    ORDER BY created_at DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
    `,
    values
  );
  return res.rows as { id: string; event_type: string; payload: any; created_at: string }[];
}

export async function getBookingByPaymentIntent(paymentIntentId: string) {
  const res = await pool.query(
    `
    SELECT id, driver_id, amount_cents, currency, status, refund_status, refund_id, checkout_session_id
    FROM bookings
    WHERE payment_intent_id = $1
    LIMIT 1;
    `,
    [paymentIntentId]
  );
  return res.rows[0] as
    | {
        id: string;
        driver_id: string;
        amount_cents: number | null;
        currency: string | null;
        status: string | null;
        refund_status: string | null;
        refund_id: string | null;
        checkout_session_id: string | null;
      }
    | undefined;
}

export async function cancelBookingByDriver({
  bookingId,
  driverId,
}: {
  bookingId: string;
  driverId: string;
}) {
  const result = await pool.query(
    `
    UPDATE bookings
    SET status = 'canceled'
    WHERE id = $1
      AND driver_id = $2
      AND end_time > now()
    RETURNING id;
    `,
    [bookingId, driverId]
  );
  return result.rowCount && result.rowCount > 0;
}

export async function getBookingForRefund({
  bookingId,
  driverId,
}: {
  bookingId: string;
  driverId: string;
}) {
  const res = await pool.query(
    `
    SELECT id, status, payment_intent_id, payout_status, end_time, refund_status, refund_id
    FROM bookings
    WHERE id = $1
      AND driver_id = $2
    `,
    [bookingId, driverId]
  );
  return res.rows[0] as
    | {
        id: string;
        status: string | null;
        payment_intent_id: string | null;
        payout_status: string | null;
        end_time: Date;
        refund_status: string | null;
        refund_id: string | null;
      }
    | undefined;
}

export async function getBookingForHostRefund({
  bookingId,
  hostId,
}: {
  bookingId: string;
  hostId: string;
}) {
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.driver_id,
      b.status,
      b.payment_intent_id,
      b.payout_status,
      b.end_time,
      b.refund_status,
      b.refund_id
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.id = $1
      AND l.host_id = $2
    `,
    [bookingId, hostId]
  );
  return res.rows[0] as
    | {
        id: string;
        driver_id: string;
        status: string | null;
        payment_intent_id: string | null;
        payout_status: string | null;
        end_time: Date;
        refund_status: string | null;
        refund_id: string | null;
      }
    | undefined;
}

export async function getBookingForExtension({
  bookingId,
  driverId,
}: {
  bookingId: string;
  driverId: string;
}) {
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.start_time,
      b.end_time,
      b.amount_cents,
      b.currency,
      b.status,
      l.price_per_day,
      l.price_per_hour,
      l.rate_type
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.id = $1
      AND b.driver_id = $2
    `,
    [bookingId, driverId]
  );
  return res.rows[0] as
    | {
        id: string;
        listing_id: string;
        start_time: Date;
        end_time: Date;
        amount_cents: number | null;
        currency: string | null;
        status: string | null;
        price_per_day: number;
        price_per_hour: number | null;
        rate_type: ListingRateType;
      }
    | undefined;
}

export async function updateBookingWindow({
  bookingId,
  driverId,
  newStartTime,
  newEndTime,
  newAmountCents,
  paymentIntentId,
  receiptUrl,
}: {
  bookingId: string;
  driverId: string;
  newStartTime: string;
  newEndTime: string;
  newAmountCents: number;
  paymentIntentId?: string | null;
  receiptUrl?: string | null;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET start_time = $1,
        end_time = $2,
        amount_cents = $3,
        payment_intent_id = COALESCE($4, payment_intent_id),
        receipt_url = COALESCE($5, receipt_url)
    WHERE id = $6
      AND driver_id = $7
      AND status = 'confirmed'
      AND end_time > NOW()
    RETURNING id, start_time, end_time, amount_cents;
    `,
    [
      newStartTime,
      newEndTime,
      newAmountCents,
      paymentIntentId ?? null,
      receiptUrl ?? null,
      bookingId,
      driverId,
    ]
  );
  return res.rows[0] as
    | { id: string; start_time: Date; end_time: Date; amount_cents: number }
    | undefined;
}

export async function updateBookingExtension({
  bookingId,
  driverId,
  newEndTime,
  newAmountCents,
  paymentIntentId,
  receiptUrl,
}: {
  bookingId: string;
  driverId: string;
  newEndTime: string;
  newAmountCents: number;
  paymentIntentId?: string | null;
  receiptUrl?: string | null;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET end_time = $1,
        amount_cents = $2,
        payment_intent_id = COALESCE($3, payment_intent_id),
        receipt_url = COALESCE($4, receipt_url)
    WHERE id = $5
      AND driver_id = $6
      AND status = 'confirmed'
      AND end_time > NOW()
    RETURNING id, end_time, amount_cents;
    `,
    [newEndTime, newAmountCents, paymentIntentId ?? null, receiptUrl ?? null, bookingId, driverId]
  );
  return res.rows[0] as { id: string; end_time: Date; amount_cents: number } | undefined;
}

export async function checkInBooking({
  bookingId,
  driverId,
}: {
  bookingId: string;
  driverId: string;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET checked_in_at = COALESCE(checked_in_at, NOW())
    WHERE id = $1
      AND driver_id = $2
      AND status = 'confirmed'
      AND start_time <= NOW() + interval '15 minutes'
      AND end_time >= NOW()
    RETURNING checked_in_at;
    `,
    [bookingId, driverId]
  );
  return res.rows[0]?.checked_in_at as Date | undefined;
}

export async function cancelBookingWithRefund({
  bookingId,
  driverId,
  refundId,
}: {
  bookingId: string;
  driverId: string;
  refundId?: string | null;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET status = 'canceled',
        payout_status = 'canceled',
        refund_status = CASE
          WHEN $3::text IS NOT NULL THEN 'succeeded'
          ELSE refund_status
        END,
        refund_id = COALESCE($3::text, refund_id),
        refunded_at = CASE
          WHEN $3::text IS NOT NULL THEN NOW()
          ELSE refunded_at
        END
    WHERE id = $1
      AND driver_id = $2
      AND end_time > NOW()
    RETURNING id;
    `,
    [bookingId, driverId, refundId ?? null]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function cancelBookingWithRefundByHost({
  bookingId,
  hostId,
  refundId,
}: {
  bookingId: string;
  hostId: string;
  refundId?: string | null;
}) {
  const res = await pool.query(
    `
    UPDATE bookings b
    SET status = 'canceled',
        payout_status = 'canceled',
        refund_status = CASE
          WHEN $3::text IS NOT NULL THEN 'succeeded'
          ELSE refund_status
        END,
        refund_id = COALESCE($3::text, refund_id),
        refunded_at = CASE
          WHEN $3::text IS NOT NULL THEN NOW()
          ELSE refunded_at
        END
    FROM listings l
    WHERE b.id = $1
      AND l.id = b.listing_id
      AND l.host_id = $2
      AND b.end_time > NOW()
    RETURNING b.id;
    `,
    [bookingId, hostId, refundId ?? null]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listUserBookings(userId: string) {
  const driverRows = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.start_time,
      b.end_time,
      b.status,
      b.refund_status,
      b.refunded_at,
      b.receipt_url,
      b.checked_in_at,
      b.no_show_at,
      b.vehicle_plate,
      b.amount_cents,
      b.currency,
      l.title,
      l.address,
      l.image_urls,
      ST_X(l.geom) AS longitude,
      ST_Y(l.geom) AS latitude,
      l.host_id,
      l.access_code,
      l.arrival_instructions,
      h.phone AS host_phone
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users h ON h.id = l.host_id
    WHERE b.driver_id = $1
      AND b.status <> 'pending'
    ORDER BY b.start_time DESC
    LIMIT 50;
    `,
    [userId]
  );

  const hostRows = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.start_time,
      b.end_time,
      b.status,
      b.refund_status,
      b.refunded_at,
      b.receipt_url,
      b.checked_in_at,
      b.no_show_at,
      b.vehicle_plate,
      b.amount_cents,
      b.currency,
      l.title,
      l.address,
      l.image_urls,
      ST_X(l.geom) AS longitude,
      ST_Y(l.geom) AS latitude,
      l.host_id,
      l.access_code,
      l.arrival_instructions,
      u.full_name AS driver_name,
      u.phone AS driver_phone,
      u.vehicle_make AS driver_vehicle_make,
      u.vehicle_type AS driver_vehicle_type,
      u.vehicle_color AS driver_vehicle_color
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users u ON u.id = b.driver_id
    WHERE l.host_id = $1
    ORDER BY b.start_time DESC
    LIMIT 50;
    `,
    [userId]
  );

  const mapRow = (row: any) => ({
    id: row.id,
    listingId: row.listing_id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status ?? "pending",
    refundStatus: row.refund_status ?? null,
    refundedAt: row.refunded_at ?? null,
    receiptUrl: row.receipt_url ?? null,
    checkedInAt: row.checked_in_at ?? null,
    noShowAt: row.no_show_at ?? null,
    vehiclePlate: row.vehicle_plate ?? null,
    amountCents: row.amount_cents ?? 0,
    currency: row.currency ?? "eur",
    address: row.address,
    title: row.title,
    imageUrls: row.image_urls ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    accessCode: row.access_code ?? null,
    arrivalInstructions: row.arrival_instructions ?? null,
    driverName: row.driver_name ?? null,
    driverPhone: row.driver_phone ?? null,
    driverVehicleMake: row.driver_vehicle_make ?? null,
    driverVehicleType: row.driver_vehicle_type ?? null,
    driverVehicleColor: row.driver_vehicle_color ?? null,
    hostPhone: row.host_phone ?? null,
  });

  const allRows = [...driverRows.rows, ...hostRows.rows];
  const bookingIds = allRows.map((row) => row.id).filter(Boolean);
  const bookingSignals =
    bookingIds.length > 0 ? await getBookingStatusSignals(bookingIds) : new Map<string, { cancellationSource?: string | null }>();

  return {
    driverBookings: driverRows.rows.map((row) => ({
      ...mapRow(row),
      cancellationSource: bookingSignals.get(row.id)?.cancellationSource ?? null,
    })),
    hostBookings: hostRows.rows.map((row) => ({
      ...mapRow(row),
      cancellationSource: bookingSignals.get(row.id)?.cancellationSource ?? null,
    })),
  };
}

async function getBookingStatusSignals(bookingIds: string[]) {
  const res = await pool.query(
    `
    SELECT
      payload->>'bookingId' AS booking_id,
      event_type,
      created_at
    FROM event_log
    WHERE payload->>'bookingId' = ANY($1::text[])
      AND event_type IN ('host_booking_canceled', 'driver_booking_canceled')
    ORDER BY created_at DESC
    `,
    [bookingIds]
  );

  const map = new Map<string, { cancellationSource?: string | null }>();
  for (const row of res.rows as Array<{ booking_id: string | null; event_type: string }>) {
    if (!row.booking_id || map.has(row.booking_id)) continue;
    map.set(row.booking_id, {
      cancellationSource:
        row.event_type === "host_booking_canceled"
          ? "host"
          : row.event_type === "driver_booking_canceled"
            ? "driver"
            : null,
    });
  }
  return map;
}

export async function getBookingById(userId: string, bookingId: string) {
  const result = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.start_time,
      b.end_time,
      b.status,
      b.refund_status,
      b.refunded_at,
      b.receipt_url,
      b.checked_in_at,
      b.no_show_at,
      b.vehicle_plate,
      b.amount_cents,
      b.currency,
      l.title,
      l.address,
      l.image_urls,
      ST_X(l.geom) AS longitude,
      ST_Y(l.geom) AS latitude,
      l.host_id,
      l.access_code,
      l.arrival_instructions,
      h.phone AS host_phone,
      d.full_name AS driver_name,
      d.phone AS driver_phone,
      d.vehicle_make AS driver_vehicle_make,
      d.vehicle_type AS driver_vehicle_type,
      d.vehicle_color AS driver_vehicle_color
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users h ON h.id = l.host_id
    JOIN users d ON d.id = b.driver_id
    WHERE b.id = $1
      AND (b.driver_id = $2 OR l.host_id = $2)
    `,
    [bookingId, userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const signals = await getBookingStatusSignals([bookingId]);

  return {
    id: row.id,
    listingId: row.listing_id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status ?? "pending",
    refundStatus: row.refund_status ?? null,
    refundedAt: row.refunded_at ?? null,
    receiptUrl: row.receipt_url ?? null,
    checkedInAt: row.checked_in_at ?? null,
    noShowAt: row.no_show_at ?? null,
    vehiclePlate: row.vehicle_plate ?? null,
    amountCents: row.amount_cents ?? 0,
    currency: row.currency ?? "eur",
    address: row.address,
    title: row.title,
    imageUrls: row.image_urls ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    accessCode: row.access_code ?? null,
    arrivalInstructions: row.arrival_instructions ?? null,
    driverName: row.driver_name ?? null,
    driverPhone: row.driver_phone ?? null,
    driverVehicleMake: row.driver_vehicle_make ?? null,
    driverVehicleType: row.driver_vehicle_type ?? null,
    driverVehicleColor: row.driver_vehicle_color ?? null,
    hostPhone: row.host_phone ?? null,
    cancellationSource: signals.get(bookingId)?.cancellationSource ?? null,
  };
}

export async function getHostEarningsSummary(hostId: string) {
  try {
    const res = await pool.query(
      `
      SELECT
        COALESCE(SUM(b.amount_cents), 0) AS total_cents,
        COALESCE(SUM(COALESCE(b.platform_fee_cents, ROUND(b.amount_cents * 0.10))), 0) AS fee_cents
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.host_id = $1
        AND b.status = 'confirmed';
      `,
      [hostId]
    );
    const row = res.rows[0] ?? { total_cents: 0, fee_cents: 0 };
    const totalCents = Number(row.total_cents) || 0;
    const feeCents = Number(row.fee_cents) || 0;
    return {
      totalCents,
      feeCents,
      netCents: Math.max(0, totalCents - feeCents),
      currency: "eur",
    };
  } catch (err: any) {
    if (err?.code === "42703") {
      const res = await pool.query(
        `
        SELECT
          COALESCE(SUM(b.amount_cents), 0) AS total_cents,
          COALESCE(SUM(ROUND(b.amount_cents * 0.10)), 0) AS fee_cents
        FROM bookings b
        JOIN listings l ON l.id = b.listing_id
        WHERE l.host_id = $1
          AND b.status = 'confirmed';
        `,
        [hostId]
      );
      const row = res.rows[0] ?? { total_cents: 0, fee_cents: 0 };
      const totalCents = Number(row.total_cents) || 0;
      const feeCents = Number(row.fee_cents) || 0;
      return {
        totalCents,
        feeCents,
        netCents: Math.max(0, totalCents - feeCents),
        currency: "eur",
      };
    }
    throw err;
  }
}

export async function listDuePayoutsForHost(hostId: string) {
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.amount_cents,
      COALESCE(b.platform_fee_cents, ROUND(b.amount_cents * 0.10)) AS fee_cents,
      b.currency,
      b.payout_available_at
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE l.host_id = $1
      AND b.status = 'confirmed'
      AND (b.payout_status IS NULL OR b.payout_status = 'pending')
      AND b.payout_available_at IS NOT NULL
      AND b.payout_available_at <= NOW();
    `,
    [hostId]
  );
  return res.rows as Array<{
    id: string;
    amount_cents: number;
    fee_cents: number;
    currency: string;
    payout_available_at: Date;
  }>;
}

export async function listDuePayoutsForAllHosts() {
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.amount_cents,
      COALESCE(b.platform_fee_cents, ROUND(b.amount_cents * 0.10)) AS fee_cents,
      b.currency,
      b.payout_available_at,
      l.host_id,
      u.host_stripe_account_id
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users u ON u.id = l.host_id
    WHERE b.status = 'confirmed'
      AND (b.payout_status IS NULL OR b.payout_status = 'pending')
      AND b.payout_available_at IS NOT NULL
      AND b.payout_available_at <= NOW()
      AND u.host_stripe_account_id IS NOT NULL;
    `
  );
  return res.rows as Array<{
    id: string;
    amount_cents: number;
    fee_cents: number;
    currency: string;
    payout_available_at: Date;
    host_id: string;
    host_stripe_account_id: string;
  }>;
}

export async function markPayoutProcessing(bookingId: string) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET payout_status = 'processing'
    WHERE id = $1
      AND (payout_status IS NULL OR payout_status = 'pending')
    RETURNING id;
    `,
    [bookingId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markPayoutTransferred({
  bookingId,
  transferId,
}: {
  bookingId: string;
  transferId: string;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET payout_status = 'paid',
        stripe_transfer_id = $2
    WHERE id = $1
    RETURNING id;
    `,
    [bookingId, transferId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markPayoutPending(bookingId: string) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET payout_status = 'pending'
    WHERE id = $1
    RETURNING id;
    `,
    [bookingId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function setHostStripeAccountId(userId: string, accountId: string) {
  const res = await pool.query(
    `UPDATE users SET host_stripe_account_id = $2 WHERE id = $1 RETURNING id, host_stripe_account_id`,
    [userId, accountId]
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function deleteUserAccount(userId: string) {
  // Clean up related records; tables do not enforce FK constraints.
  await pool.query(
    `DELETE FROM bookings WHERE driver_id = $1 OR listing_id IN (SELECT id FROM listings WHERE host_id = $1)`,
    [userId]
  );
  await pool.query(`DELETE FROM listings WHERE host_id = $1`, [userId]);
  const res = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
  return (res.rowCount ?? 0) > 0;
}

// Admin utilities
export async function getAdminDashboardMetrics() {
  const ratio = (numerator: number, denominator: number) =>
    denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
  const res = await pool.query(
    `
    SELECT
      (SELECT COUNT(*) FROM users) AS user_count,
      (SELECT COUNT(*) FROM listings) AS listing_count,
      (SELECT COUNT(*) FROM listings WHERE status = 'approved') AS active_listing_count,
      (SELECT COUNT(*) FROM bookings WHERE created_at >= NOW() - interval '30 days') AS bookings_30d,
      (
        SELECT COALESCE(SUM(amount_cents), 0)
        FROM bookings
        WHERE created_at >= NOW() - interval '30 days'
          AND status = 'confirmed'
      ) AS gmv_30d_cents,
      (
        SELECT COUNT(*)
        FROM bookings
        WHERE payout_status IN ('pending', 'processing')
          AND payout_available_at IS NOT NULL
          AND payout_available_at <= NOW()
      ) AS payout_backlog
    `
  );
  const row = res.rows[0] ?? {};
  const bookingsSeries = await pool.query(
    `
    WITH days AS (
      SELECT generate_series(
        current_date - interval '29 days',
        current_date,
        interval '1 day'
      )::date AS day
    ),
    stats AS (
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*)::int AS count,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'confirmed'), 0)::int AS gmv_cents
      FROM bookings
      WHERE created_at >= current_date - interval '29 days'
      GROUP BY 1
    )
    SELECT d.day, COALESCE(s.count, 0) AS count, COALESCE(s.gmv_cents, 0) AS gmv_cents
    FROM days d
    LEFT JOIN stats s ON s.day = d.day
    ORDER BY d.day ASC
    `
  );

  const listingStatus = await pool.query(
    `
    SELECT COALESCE(status, 'unknown') AS status, COUNT(*)::int AS count
    FROM listings
    GROUP BY COALESCE(status, 'unknown')
    ORDER BY count DESC
    `
  );

  const fraudEvents = await pool.query(
    `
    SELECT event_type, COUNT(*)::int AS count
    FROM event_log
    WHERE created_at >= NOW() - interval '30 days'
    GROUP BY event_type
    ORDER BY count DESC
    LIMIT 10
    `
  );

  const recentOperationalEvents = await pool.query(
    `
    SELECT id, event_type, payload, created_at
    FROM event_log
    WHERE event_type IN (
      'booking_conflict',
      'booking_email_failed',
      'orphan_payment_refunded',
      'orphan_payment_already_refunded',
      'stripe_webhook_failed',
      'operational_alert',
      'host_booking_canceled',
      'booking_status_transition_skipped'
    )
    ORDER BY created_at DESC
    LIMIT 8
    `
  );

  const recentProductFailures = await pool.query(
    `
    SELECT id, event_type, payload, created_at
    FROM event_log
    WHERE event_type IN (
      'web_search_failed',
      'mobile_search_failed',
      'web_host_publish_failed',
      'mobile_host_publish_failed',
      'mobile_booking_failed',
      'client.error_reported'
    )
    ORDER BY created_at DESC
    LIMIT 10
    `
  );

  const funnelCounts = await pool.query(
    `
    SELECT event_type, COUNT(*)::int AS count
    FROM event_log
    WHERE created_at >= NOW() - interval '30 days'
      AND event_type IN (
        'signup_completed',
        'email_verified',
        'login_succeeded',
        'listing_published',
        'booking_checkout_started',
        'booking_payment_intent_created',
        'booking_confirmed',
        'web_login_succeeded',
        'mobile_login_succeeded',
        'web_signup_completed',
        'mobile_signup_completed',
        'web_search_completed',
        'mobile_search_completed',
        'web_listing_viewed',
        'mobile_listing_viewed',
        'web_booking_started',
        'mobile_booking_started',
        'mobile_booking_confirmed',
        'web_host_publish_succeeded',
        'mobile_host_publish_succeeded'
      )
    GROUP BY event_type
    `
  );
  const funnelMap = new Map<string, number>();
  for (const row of funnelCounts.rows as Array<{ event_type: string; count: number }>) {
    funnelMap.set(row.event_type, Number(row.count ?? 0));
  }

  const signupSignedUp =
    (funnelMap.get("signup_completed") ?? 0) +
    (funnelMap.get("web_signup_completed") ?? 0) +
    (funnelMap.get("mobile_signup_completed") ?? 0);
  const signupVerified = funnelMap.get("email_verified") ?? 0;
  const signupLoggedIn =
    (funnelMap.get("login_succeeded") ?? 0) +
    (funnelMap.get("web_login_succeeded") ?? 0) +
    (funnelMap.get("mobile_login_succeeded") ?? 0);
  const discoverySearchCompleted =
    (funnelMap.get("web_search_completed") ?? 0) +
    (funnelMap.get("mobile_search_completed") ?? 0);
  const discoveryListingViewed =
    (funnelMap.get("web_listing_viewed") ?? 0) +
    (funnelMap.get("mobile_listing_viewed") ?? 0);
  const bookingListingPublished =
    (funnelMap.get("listing_published") ?? 0) +
    (funnelMap.get("web_host_publish_succeeded") ?? 0) +
    (funnelMap.get("mobile_host_publish_succeeded") ?? 0);
  const bookingCheckoutStarted =
    (funnelMap.get("booking_checkout_started") ?? 0) +
    (funnelMap.get("web_booking_started") ?? 0) +
    (funnelMap.get("mobile_booking_started") ?? 0);
  const bookingPaymentIntentCreated = funnelMap.get("booking_payment_intent_created") ?? 0;
  const bookingConfirmed =
    (funnelMap.get("booking_confirmed") ?? 0) +
    (funnelMap.get("mobile_booking_confirmed") ?? 0);

  return {
    userCount: Number(row.user_count ?? 0),
    listingCount: Number(row.listing_count ?? 0),
    activeListingCount: Number(row.active_listing_count ?? 0),
    bookings30d: Number(row.bookings_30d ?? 0),
    gmv30dCents: Number(row.gmv_30d_cents ?? 0),
    payoutBacklog: Number(row.payout_backlog ?? 0),
    bookingsDaily: bookingsSeries.rows.map((r) => ({
      day: r.day,
      count: Number(r.count ?? 0),
      gmvCents: Number(r.gmv_cents ?? 0),
    })),
    listingStatus: listingStatus.rows.map((r) => ({
      status: r.status,
      count: Number(r.count ?? 0),
    })),
    fraudByType: fraudEvents.rows.map((r) => ({
      eventType: r.event_type,
      count: Number(r.count ?? 0),
    })),
    recentOperationalEvents: recentOperationalEvents.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      payload: row.payload ?? null,
      createdAt: row.created_at,
    })),
    recentProductFailures: recentProductFailures.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      payload: row.payload ?? null,
      createdAt: row.created_at,
    })),
    signupFunnel: {
      signedUp: signupSignedUp,
      verifiedEmail: signupVerified,
      loggedIn: signupLoggedIn,
      verifyRate: ratio(signupVerified, signupSignedUp),
      loginRate: ratio(signupLoggedIn, signupVerified || signupSignedUp),
    },
    discoveryFunnel: {
      searchCompleted: discoverySearchCompleted,
      listingViewed: discoveryListingViewed,
      listingViewRate: ratio(discoveryListingViewed, discoverySearchCompleted),
    },
    bookingFunnel: {
      listingPublished: bookingListingPublished,
      checkoutStarted: bookingCheckoutStarted,
      paymentIntentCreated: bookingPaymentIntentCreated,
      confirmed: bookingConfirmed,
      checkoutToIntentRate: ratio(bookingPaymentIntentCreated, bookingCheckoutStarted),
      checkoutToConfirmedRate: ratio(bookingConfirmed, bookingCheckoutStarted),
      publishToCheckoutRate: ratio(bookingCheckoutStarted, bookingListingPublished),
    },
  };
}

export async function listBookingsForAdmin({
  limit = 50,
  offset = 0,
  status,
  from,
  to,
  listingId,
  userId,
}: {
  limit?: number;
  offset?: number;
  status?: string;
  from?: string;
  to?: string;
  listingId?: string;
  userId?: string;
}) {
  const params: any[] = [limit, offset];
  const filters: string[] = [];
  if (status) {
    params.push(status);
    filters.push(`b.status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    filters.push(`b.start_time >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    filters.push(`b.end_time <= $${params.length}::timestamptz`);
  }
  if (listingId) {
    params.push(listingId);
    filters.push(`b.listing_id = $${params.length}`);
  }
  if (userId) {
    params.push(userId);
    filters.push(`b.driver_id = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.driver_id,
      b.start_time,
      b.end_time,
      b.status,
      b.amount_cents,
      b.currency,
      b.payment_intent_id,
      b.checkout_session_id,
      b.refund_status,
      b.refunded_at,
      b.no_show_at,
      b.payout_status,
      b.payout_available_at,
      b.created_at,
      l.title AS listing_title,
      l.address AS listing_address,
      l.host_id,
      driver.email AS driver_email,
      host.email AS host_email
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    LEFT JOIN users driver ON driver.id = b.driver_id
    LEFT JOIN users host ON host.id = l.host_id
    ${where}
    ORDER BY b.created_at DESC
    LIMIT $1 OFFSET $2;
    `,
    params
  );
  return res.rows;
}

export async function getBookingForAdmin(bookingId: string) {
  const res = await pool.query(
    `
    SELECT
      b.*,
      l.title AS listing_title,
      l.address AS listing_address,
      l.host_id,
      driver.email AS driver_email,
      host.email AS host_email
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    LEFT JOIN users driver ON driver.id = b.driver_id
    LEFT JOIN users host ON host.id = l.host_id
    WHERE b.id = $1
    LIMIT 1;
    `,
    [bookingId]
  );
  return res.rows[0];
}

export async function updateBookingAsAdmin({
  bookingId,
  status,
  refundId,
  markNoShow,
}: {
  bookingId: string;
  status?: string;
  refundId?: string | null;
  markNoShow?: boolean;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET status = COALESCE($2, status),
        payout_status = CASE
          WHEN $2 = 'canceled' THEN 'canceled'
          ELSE payout_status
        END,
        refund_status = CASE
          WHEN $3::text IS NOT NULL THEN 'succeeded'
          ELSE refund_status
        END,
        refund_id = COALESCE($3::text, refund_id),
        refunded_at = CASE
          WHEN $3::text IS NOT NULL THEN NOW()
          ELSE refunded_at
        END,
        no_show_at = CASE
          WHEN $4::boolean IS TRUE THEN COALESCE(no_show_at, NOW())
          ELSE no_show_at
        END
    WHERE id = $1
    RETURNING id, status, refund_status, refunded_at, no_show_at;
    `,
    [bookingId, status ?? null, refundId ?? null, markNoShow ?? null]
  );
  return res.rows[0];
}

export async function listPaymentsForAdmin({
  limit = 50,
  offset = 0,
  status,
}: {
  limit?: number;
  offset?: number;
  status?: string;
}) {
  const params: any[] = [limit, offset];
  let where = "WHERE b.payment_intent_id IS NOT NULL";
  if (status) {
    params.push(status);
    where += ` AND b.status = $${params.length}`;
  }
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.payment_intent_id,
      b.checkout_session_id,
      b.amount_cents,
      b.currency,
      b.status,
      b.receipt_url,
      b.created_at,
      driver.email AS driver_email,
      l.title AS listing_title
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    LEFT JOIN users driver ON driver.id = b.driver_id
    ${where}
    ORDER BY b.created_at DESC
    LIMIT $1 OFFSET $2;
    `,
    params
  );
  return res.rows;
}

export async function listPayoutsForAdmin({
  limit = 50,
  offset = 0,
  status,
}: {
  limit?: number;
  offset?: number;
  status?: string;
}) {
  const params: any[] = [limit, offset];
  let where = "WHERE b.payout_status IS NOT NULL";
  if (status) {
    params.push(status);
    where += ` AND b.payout_status = $${params.length}`;
  }
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.amount_cents,
      b.platform_fee_cents,
      b.currency,
      b.payout_status,
      b.payout_available_at,
      b.stripe_transfer_id,
      b.created_at,
      l.title AS listing_title,
      host.email AS host_email
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    LEFT JOIN users host ON host.id = l.host_id
    ${where}
    ORDER BY b.payout_available_at DESC NULLS LAST
    LIMIT $1 OFFSET $2;
    `,
    params
  );
  return res.rows;
}

export async function createSupportTicket({
  userId,
  subject,
  message,
}: {
  userId?: string | null;
  subject: string;
  message: string;
}) {
  const res = await pool.query(
    `
    INSERT INTO support_tickets (user_id, subject, message)
    VALUES ($1, $2, $3)
    RETURNING id, created_at;
    `,
    [userId ?? null, subject, message]
  );
  return res.rows[0];
}

export async function getLatestSupportTicketForUser(userId: string) {
  const res = await pool.query(
    `
    SELECT id, subject, message, created_at
    FROM support_tickets
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 1;
    `,
    [userId]
  );
  return res.rows[0] as { id: string; subject: string; message: string; created_at: string } | undefined;
}

export async function listSupportTickets({
  limit = 50,
  offset = 0,
  status,
  priority,
  search,
}: {
  limit?: number;
  offset?: number;
  status?: string;
  priority?: string;
  search?: string;
}) {
  const params: any[] = [limit, offset];
  const filters: string[] = [];
  if (status) {
    params.push(status);
    filters.push(`t.status = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    filters.push(`t.priority = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    filters.push(`(LOWER(t.subject) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const res = await pool.query(
    `
    SELECT
      t.id,
      t.subject,
      t.message,
      t.status,
      t.priority,
      t.admin_note,
      t.assigned_admin_id,
      t.created_at,
      t.updated_at,
      u.email AS user_email
    FROM support_tickets t
    LEFT JOIN users u ON u.id = t.user_id
    ${where}
    ORDER BY t.updated_at DESC
    LIMIT $1 OFFSET $2;
    `,
    params
  );
  return res.rows;
}

export async function updateSupportTicket({
  ticketId,
  status,
  priority,
  assignedAdminId,
  adminNote,
}: {
  ticketId: string;
  status?: string;
  priority?: string;
  assignedAdminId?: string | null;
  adminNote?: string | null;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (status) {
    fields.push(`status = $${idx++}`);
    values.push(status);
  }
  if (priority) {
    fields.push(`priority = $${idx++}`);
    values.push(priority);
  }
  if (assignedAdminId !== undefined) {
    fields.push(`assigned_admin_id = $${idx++}`);
    values.push(assignedAdminId ?? null);
  }
  if (adminNote !== undefined) {
    fields.push(`admin_note = $${idx++}`);
    values.push(adminNote ?? null);
  }
  if (!fields.length) return null;
  fields.push(`updated_at = NOW()`);
  values.push(ticketId);
  const res = await pool.query(
    `
    UPDATE support_tickets
    SET ${fields.join(", ")}
    WHERE id = $${idx}
    RETURNING id, status, priority, admin_note, assigned_admin_id, updated_at;
    `,
    values
  );
  return res.rows[0];
}

export async function listAdminSettings() {
  const res = await pool.query(`SELECT key, value, updated_by, updated_at FROM admin_settings ORDER BY key ASC;`);
  return res.rows;
}

export async function upsertAdminSetting({
  key,
  value,
  updatedBy,
}: {
  key: string;
  value: any;
  updatedBy?: string | null;
}) {
  const res = await pool.query(
    `
    INSERT INTO admin_settings (key, value, updated_by, updated_at)
    VALUES ($1, $2::jsonb, $3, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    RETURNING key, value, updated_by, updated_at;
    `,
    [key, JSON.stringify(value ?? null), updatedBy ?? null]
  );
  return res.rows[0];
}

export async function listUsers({ limit = 50, offset = 0, search }: { limit?: number; offset?: number; search?: string }) {
  const params: any[] = [limit, offset];
  let where = "";
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where = "WHERE LOWER(email) LIKE $" + params.length;
  }
  const res = await pool.query(
    `
    SELECT id, email, role, status, created_at
    FROM users
    ${where}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
    `,
    params
  );
  return res.rows;
}

export async function updateUserStatus({
  userId,
  status,
  role,
  adminNote,
}: {
  userId: string;
  status?: string;
  role?: string;
  adminNote?: string;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (status) {
    fields.push(`status = $${idx++}`);
    values.push(status);
  }
  if (role) {
    fields.push(`role = $${idx++}`);
    values.push(role);
  }
  if (adminNote !== undefined) {
    fields.push(`admin_note = $${idx++}`);
    values.push(adminNote);
  }
  if (!fields.length) return null;
  values.push(userId);
  const res = await pool.query(
    `
    UPDATE users
    SET ${fields.join(", ")}
    WHERE id = $${idx}
    RETURNING id, email, role, status;
    `,
    values
  );
  return res.rows[0];
}

export async function listListingsForAdmin({ status, limit = 50, offset = 0 }: { status?: string; limit?: number; offset?: number }) {
  const params: any[] = [limit, offset];
  let where = "";
  if (status) {
    params.push(status);
    where = `WHERE status = $${params.length}`;
  }
  const res = await pool.query(
    `
    SELECT id, title, address, status, moderation_reason, moderation_note, created_at, host_id
    FROM listings
    ${where}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
    `,
    params
  );
  return res.rows;
}

export async function updateListingStatus({
  listingId,
  status,
  moderationReason,
  moderationNote,
}: {
  listingId: string;
  status: string;
  moderationReason?: string;
  moderationNote?: string;
}) {
  const res = await pool.query(
    `
    UPDATE listings
    SET status = $2,
        moderation_reason = $3,
        moderation_note = $4
    WHERE id = $1
    RETURNING id, status, moderation_reason, moderation_note;
    `,
    [listingId, status, moderationReason ?? null, moderationNote ?? null]
  );
  return res.rows[0];
}

export async function insertAuditLog({
  adminId,
  action,
  targetType,
  targetId,
  beforeState,
  afterState,
  reason,
  ip,
  ua,
}: {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string;
  beforeState?: any;
  afterState?: any;
  reason?: string;
  ip?: string;
  ua?: string;
}) {
  await pool.query(
    `
    INSERT INTO audit_log (admin_id, action, target_type, target_id, before_state, after_state, reason, ip_address, user_agent)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9);
    `,
    [adminId, action, targetType, targetId ?? null, beforeState ?? null, afterState ?? null, reason ?? null, ip ?? null, ua ?? null]
  );
}

export async function getBookingForReview(bookingId: string) {
  const result = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.driver_id,
      b.start_time,
      b.end_time,
      b.status,
      l.host_id
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.id = $1
    LIMIT 1;
    `,
    [bookingId]
  );
  return result.rows[0] as
    | {
        id: string;
        listing_id: string;
        driver_id: string;
        start_time: string;
        end_time: string;
        status?: string;
        host_id: string;
      }
    | undefined;
}

export async function hasExistingReview({ bookingId, role }: { bookingId: string; role: "driver_review" | "host_review" }) {
  const result = await pool.query(`SELECT 1 FROM reviews WHERE booking_id = $1 AND role = $2 LIMIT 1`, [bookingId, role]);
  return (result.rowCount ?? 0) > 0;
}

export async function insertReview({
  bookingId,
  authorId,
  targetUserId,
  listingId,
  role,
  rating,
  comment,
}: {
  bookingId: string;
  authorId: string;
  targetUserId: string;
  listingId: string;
  role: "driver_review" | "host_review";
  rating: number;
  comment?: string;
}) {
  const result = await pool.query(
    `
    INSERT INTO reviews (booking_id, author_id, target_user_id, listing_id, role, rating, comment)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, rating, comment, created_at, role;
    `,
    [bookingId, authorId, targetUserId, listingId, role, rating, comment ?? null]
  );
  return result.rows[0];
}

export async function refreshListingRating(listingId: string) {
  const result = await pool.query(
    `
    WITH agg AS (
      SELECT
        COUNT(*)::int AS rating_count,
        COALESCE(AVG(rating), 0) AS rating
      FROM reviews
      WHERE listing_id = $1 AND role = 'driver_review'
    )
    UPDATE listings
    SET rating = COALESCE(agg.rating, 0),
        rating_count = COALESCE(agg.rating_count, 0)
    FROM agg
    WHERE listings.id = $1
    RETURNING listings.rating, listings.rating_count;
    `,
    [listingId]
  );
  return result.rows[0] as { rating: number; rating_count: number } | undefined;
}

export async function listListingReviews({
  listingId,
  limit = 20,
  offset = 0,
}: {
  listingId: string;
  limit?: number;
  offset?: number;
}) {
  const result = await pool.query(
    `
    SELECT
      r.id,
      r.rating,
      r.comment,
      r.created_at,
      u.email AS author_email
    FROM reviews r
    JOIN users u ON u.id = r.author_id
    WHERE r.listing_id = $1 AND r.role = 'driver_review'
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3;
    `,
    [listingId, limit, offset]
  );
  return result.rows.map((row) => ({
    id: row.id,
    rating: Number(row.rating),
    comment: row.comment ?? "",
    createdAt: row.created_at,
    authorEmail: row.author_email,
  }));
}

export type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_redemptions: number | null;
  max_redemptions_per_user: number;
  min_amount_cents: number;
  starts_at: Date | null;
  expires_at: Date | null;
  active: boolean;
  created_at: Date;
};

export function normalizePromoCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export async function getPromoCodeByCode(code: string) {
  const result = await pool.query(
    `SELECT * FROM promo_codes WHERE code = $1 LIMIT 1`,
    [normalizePromoCode(code)]
  );
  return (result.rows[0] as PromoCode | undefined) ?? null;
}

export async function getPromoRedemptionCounts(promoCodeId: string, userId: string) {
  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE driver_id = $2)::int AS by_user
     FROM bookings
     WHERE promo_code_id = $1
       AND (status IS NULL OR status <> 'canceled')`,
    [promoCodeId, userId]
  );
  const row = result.rows[0] ?? { total: 0, by_user: 0 };
  return { total: Number(row.total), byUser: Number(row.by_user) };
}

// Stripe rejects charges under €0.50, so a discount never brings the
// charged total below this floor.
const MIN_CHARGE_CENTS = 50;

export type PromoValidationResult =
  | { ok: true; promo: PromoCode; discountCents: number; finalCents: number }
  | { ok: false; message: string };

export async function validatePromoForBooking({
  code,
  userId,
  amountCents,
}: {
  code: string;
  userId: string;
  amountCents: number;
}): Promise<PromoValidationResult> {
  const promo = await getPromoCodeByCode(code);
  if (!promo || !promo.active) {
    return { ok: false, message: "That promo code isn't valid." };
  }
  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
    return { ok: false, message: "That promo code isn't active yet." };
  }
  if (promo.expires_at && new Date(promo.expires_at).getTime() < now) {
    return { ok: false, message: "That promo code has expired." };
  }
  if (amountCents < promo.min_amount_cents) {
    const min = (promo.min_amount_cents / 100).toFixed(2);
    return { ok: false, message: `This code needs a booking of at least €${min}.` };
  }
  const counts = await getPromoRedemptionCounts(promo.id, userId);
  if (promo.max_redemptions != null && counts.total >= promo.max_redemptions) {
    return { ok: false, message: "That promo code has been fully redeemed." };
  }
  if (counts.byUser >= promo.max_redemptions_per_user) {
    return { ok: false, message: "You've already used this promo code." };
  }
  const rawDiscount =
    promo.discount_type === "percent"
      ? Math.round((amountCents * promo.discount_value) / 100)
      : promo.discount_value;
  const discountCents = Math.min(rawDiscount, Math.max(amountCents - MIN_CHARGE_CENTS, 0));
  if (discountCents <= 0) {
    return { ok: false, message: "This code can't be applied to that booking." };
  }
  return { ok: true, promo, discountCents, finalCents: amountCents - discountCents };
}

export async function listPromoCodes() {
  const result = await pool.query(
    `SELECT
       p.*,
       (SELECT COUNT(*)::int FROM bookings b
        WHERE b.promo_code_id = p.id AND (b.status IS NULL OR b.status <> 'canceled')) AS redemption_count
     FROM promo_codes p
     ORDER BY p.created_at DESC`
  );
  return result.rows as (PromoCode & { redemption_count: number })[];
}

export async function createPromoCode(input: {
  code: string;
  description?: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxRedemptions?: number | null;
  maxRedemptionsPerUser?: number;
  minAmountCents?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
}) {
  const result = await pool.query(
    `INSERT INTO promo_codes (
       code, description, discount_type, discount_value,
       max_redemptions, max_redemptions_per_user, min_amount_cents,
       starts_at, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      normalizePromoCode(input.code),
      input.description ?? null,
      input.discountType,
      input.discountValue,
      input.maxRedemptions ?? null,
      input.maxRedemptionsPerUser ?? 1,
      input.minAmountCents ?? 0,
      input.startsAt ?? null,
      input.expiresAt ?? null,
    ]
  );
  return result.rows[0] as PromoCode;
}

export async function updatePromoCode(
  id: string,
  patch: {
    active?: boolean;
    description?: string | null;
    maxRedemptions?: number | null;
    maxRedemptionsPerUser?: number;
    expiresAt?: string | null;
  }
) {
  const result = await pool.query(
    `UPDATE promo_codes
     SET active = COALESCE($2, active),
         description = COALESCE($3, description),
         max_redemptions = CASE WHEN $4::boolean THEN $5 ELSE max_redemptions END,
         max_redemptions_per_user = COALESCE($6, max_redemptions_per_user),
         expires_at = CASE WHEN $7::boolean THEN $8 ELSE expires_at END
     WHERE id = $1
     RETURNING *`,
    [
      id,
      patch.active ?? null,
      patch.description ?? null,
      patch.maxRedemptions !== undefined,
      patch.maxRedemptions ?? null,
      patch.maxRedemptionsPerUser ?? null,
      patch.expiresAt !== undefined,
      patch.expiresAt ?? null,
    ]
  );
  return (result.rows[0] as PromoCode | undefined) ?? null;
}
