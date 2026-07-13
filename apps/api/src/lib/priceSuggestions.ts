// Location-aware host price suggestions (docs/PRICING_STRATEGY.md §3, "hosts
// set prices; FreeSpace recommends"). Served via GET /api/config so the table
// can be tuned server-side without an app release, exactly like the fee
// schedule. These are SUGGESTIONS ONLY — hosts always set the final price and
// the server never enforces these values anywhere in booking math.
//
// The zone figures are a curated launch table anchored to public Irish market
// data (Parkpnp/Wayleadr district guides, commercial car-park rates minus a
// ~40% peer discount), not live comparables — replace with real
// comparable-based suggestions once listing density exists (Phase 2).
//
// MIRROR: apps/mobile/utils/priceSuggestions.ts bakes in this same table as
// its offline fallback. Keep the two tables identical when tuning defaults.

export type PriceSuggestionZone = {
  // Ops-facing name; also useful in analytics to see which zone fired.
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  // Host-set (pre-fee) suggested rates in euro.
  hourly: number;
  daily: number;
  monthly: number;
};

export type PriceSuggestionConfig = {
  // Evaluated in order; the FIRST zone whose radius contains the point wins,
  // so tighter city-core zones must precede the wider rings that contain them.
  zones: PriceSuggestionZone[];
  // Rest-of-Ireland rates when no zone matches.
  fallback: { hourly: number; daily: number; monthly: number };
};

const DUBLIN = { lat: 53.3475, lng: -6.26 };

const PRICE_SUGGESTION_CONFIG: PriceSuggestionConfig = {
  zones: [
    { name: "dublin-core",   ...DUBLIN, radiusKm: 1.8,  hourly: 2.5, daily: 14, monthly: 180 },
    { name: "dublin-inner",  ...DUBLIN, radiusKm: 4.5,  hourly: 2.0, daily: 11, monthly: 140 },
    { name: "dublin-county", ...DUBLIN, radiusKm: 18,   hourly: 1.5, daily: 8,  monthly: 100 },
    { name: "cork-city",     lat: 51.8985, lng: -8.4756, radiusKm: 3, hourly: 1.5, daily: 8, monthly: 110 },
    { name: "galway-city",   lat: 53.2745, lng: -9.0514, radiusKm: 3, hourly: 1.5, daily: 8, monthly: 100 },
    { name: "limerick-city", lat: 52.6653, lng: -8.6238, radiusKm: 3, hourly: 1.2, daily: 7, monthly: 90 },
  ],
  fallback: { hourly: 1.0, daily: 6, monthly: 70 },
};

export function getPriceSuggestionConfig(): PriceSuggestionConfig {
  return PRICE_SUGGESTION_CONFIG;
}
