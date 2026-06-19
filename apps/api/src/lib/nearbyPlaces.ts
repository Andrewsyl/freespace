import "../loadEnv.js";

// One cached "Getting around" entry shown on the listing detail screen.
export type NearbyPlace = {
  name: string;
  category: "transit" | "tram" | "stadium" | "landmark" | "park";
  walkMinutes: number;
  distanceMeters: number;
  placeId: string;
};

// Each category is one Google Places "Nearby Search" call (rankby=distance →
// nearest first). We keep the closest result within the walking threshold. This
// runs once per listing and the result is cached in listings.nearby, so the
// per-view cost is zero.
const CATEGORIES: { category: NearbyPlace["category"]; type: string; maxMeters: number }[] = [
  { category: "transit", type: "train_station", maxMeters: 2000 },
  { category: "tram", type: "light_rail_station", maxMeters: 1500 },
  { category: "stadium", type: "stadium", maxMeters: 2500 },
  { category: "landmark", type: "tourist_attraction", maxMeters: 1200 },
  { category: "park", type: "park", maxMeters: 1000 },
];

const MAX_RESULTS = 4;

// Haversine distance in metres.
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rough walking time: straight-line distance with a 1.35 detour factor at
// ~80 m/min (≈4.8 km/h). Good enough for "8 min walk" without a second
// (paid) Distance Matrix call.
function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.35) / 80));
}

async function nearestOfType(
  lat: number,
  lng: number,
  type: string,
  key: string
): Promise<{ name: string; placeId: string; meters: number } | null> {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    rankby: "distance",
    type,
    key,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`
  );
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: { name?: string; place_id?: string; geometry?: { location?: { lat: number; lng: number } } }[];
  };
  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK" || !data.results?.length) {
    if (data.status) console.warn("Nearby search non-OK", type, data.status, data.error_message);
    return null;
  }
  const first = data.results.find((r) => r.place_id && r.geometry?.location && r.name);
  if (!first?.geometry?.location) return null;
  return {
    name: first.name!,
    placeId: first.place_id!,
    meters: Math.round(distanceMeters(lat, lng, first.geometry.location.lat, first.geometry.location.lng)),
  };
}

// Fetch the nearby places for a listing location. Returns [] on missing key or
// total failure (so we still cache an answer and stop re-querying).
export async function fetchNearbyPlaces(lat: number, lng: number): Promise<NearbyPlace[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.warn("GOOGLE_MAPS_API_KEY missing; nearby places will be empty");
    return [];
  }

  const found = await Promise.all(
    CATEGORIES.map(async ({ category, type, maxMeters }) => {
      try {
        const nearest = await nearestOfType(lat, lng, type, key);
        if (!nearest || nearest.meters > maxMeters) return null;
        return {
          name: nearest.name,
          category,
          walkMinutes: walkMinutes(nearest.meters),
          distanceMeters: nearest.meters,
          placeId: nearest.placeId,
        } satisfies NearbyPlace;
      } catch (err) {
        console.warn("Nearby search error", type, err);
        return null;
      }
    })
  );

  const seen = new Set<string>();
  return found
    .filter((p): p is NearbyPlace => p !== null)
    .filter((p) => (seen.has(p.placeId) ? false : (seen.add(p.placeId), true)))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_RESULTS);
}
