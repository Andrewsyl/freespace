// Location-aware host price suggestions for the listing flow's pricing step.
// The zone table is served by GET /api/config (apps/api/src/lib/
// priceSuggestions.ts) and applied at boot via remoteConfig.ts, same pattern
// as the platform fee schedule; the DEFAULT_* table below is the offline
// fallback and MUST stay identical to the server's defaults.
//
// Suggestions are advisory only: they prefill the price fields, the host can
// change them freely, and no booking math ever verifies against them — so a
// stale table can never break a booking, unlike the fee schedule.

export type PriceSuggestionZone = {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  hourly: number;
  daily: number;
  monthly: number;
};

export type PriceSuggestionConfig = {
  // First zone containing the point wins — tighter zones precede wider rings.
  zones: PriceSuggestionZone[];
  fallback: { hourly: number; daily: number; monthly: number };
};

const DUBLIN = { lat: 53.3475, lng: -6.26 };

export const DEFAULT_PRICE_SUGGESTION_CONFIG: PriceSuggestionConfig = {
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

let config: PriceSuggestionConfig = DEFAULT_PRICE_SUGGESTION_CONFIG;

function isValidRates(v: { hourly?: unknown; daily?: unknown; monthly?: unknown } | null | undefined) {
  if (!v) return false;
  return [v.hourly, v.daily, v.monthly].every(
    (n) => typeof n === "number" && Number.isFinite(n) && n > 0
  );
}

// Reject junk wholesale (same stance as setPlatformFeeSchedule): a partially
// valid table would suggest nonsense prices, and the baked-in defaults are
// always a safe fallback.
export function setPriceSuggestionConfig(next: Partial<PriceSuggestionConfig> | null | undefined) {
  if (!next || !Array.isArray(next.zones) || next.zones.length === 0) return;
  if (!isValidRates(next.fallback)) return;
  for (const zone of next.zones) {
    if (!zone || typeof zone.name !== "string") return;
    if (![zone.lat, zone.lng, zone.radiusKm].every((n) => typeof n === "number" && Number.isFinite(n))) return;
    if (zone.radiusKm <= 0) return;
    if (!isValidRates(zone)) return;
  }
  config = { zones: next.zones, fallback: next.fallback! };
}

// Feature-based bumps applied on top of the zone rate. Kept client-side as
// small constants (they nudge, the zone dominates); multiplicative and capped
// by construction since each feature applies at most once.
const FEATURE_MULTIPLIERS: Array<{ features: string[]; multiplier: number }> = [
  { features: ["EV charging"], multiplier: 1.15 },
  // Either form of protection reads as "premium space" to drivers; don't
  // stack Sheltered and Gated access separately.
  { features: ["Sheltered", "Gated access"], multiplier: 1.1 },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Friendly rounding so suggestions read as prices a person would pick, not
// computed artifacts: hourly to 10c, daily to 50c, monthly to €5. The final
// cent-rounding strips float noise (29 × 0.1 === 2.9000000000000004).
const roundTo = (v: number, step: number) =>
  Math.round(Math.round(v / step) * step * 100) / 100;

export type PriceSuggestion = {
  hourly: number;
  daily: number;
  monthly: number;
  // Which zone fired (or "fallback") — for analytics on suggestion quality.
  zone: string;
};

export function suggestPrices(params: {
  latitude: number;
  longitude: number;
  features?: string[];
}): PriceSuggestion {
  const { latitude, longitude, features = [] } = params;
  const hasCoords =
    Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0);

  let zoneName = "fallback";
  let rates = config.fallback;
  if (hasCoords) {
    for (const zone of config.zones) {
      if (haversineKm(latitude, longitude, zone.lat, zone.lng) <= zone.radiusKm) {
        zoneName = zone.name;
        rates = zone;
        break;
      }
    }
  }

  let multiplier = 1;
  for (const bump of FEATURE_MULTIPLIERS) {
    if (bump.features.some((f) => features.includes(f))) multiplier *= bump.multiplier;
  }

  return {
    hourly: roundTo(rates.hourly * multiplier, 0.1),
    daily: roundTo(rates.daily * multiplier, 0.5),
    monthly: roundTo(rates.monthly * multiplier, 5),
    zone: zoneName,
  };
}
