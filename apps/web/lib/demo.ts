// Portfolio demo mode (NEXT_PUBLIC_DEMO_MODE=1). The production API and database
// are torn down; every API call is answered in-process from a frozen, scrubbed
// snapshot of the live listings (demo/data.json). Browsing works; anything that
// would write, authenticate or take payment returns DEMO_MESSAGE instead.
import data from "../demo/data.json";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export const DEMO_MESSAGE =
  "This is a portfolio demo of FreeSpace. Browsing works, but accounts, bookings and payments are switched off.";

// The snapshot stores Street View URLs without the Maps key so no key is
// committed; it is appended here from the env, as the live API used to do.
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const withMapsKey = (url: string) =>
  url.includes("maps.googleapis.com/maps/api/streetview") && MAPS_KEY ? `${url}&key=${MAPS_KEY}` : url;

const listings = data.listings.map((l) => ({ ...l, imageUrls: l.imageUrls.map(withMapsKey) }));

type DemoListing = (typeof listings)[number];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function search(params: URLSearchParams) {
  const lat = Number(params.get("lat") ?? 53.3498);
  const lng = Number(params.get("lng") ?? -6.2603);
  const radiusKm = Number(params.get("radiusKm") ?? 5);
  const priceMin = params.has("priceMin") ? Number(params.get("priceMin")) : null;
  const priceMax = params.has("priceMax") ? Number(params.get("priceMax")) : null;
  const price = (l: DemoListing) => l.pricePerHour ?? l.pricePerDay;

  const spaces = listings
    .map((l) => ({ ...l, distanceKm: distanceKm(lat, lng, l.latitude, l.longitude) }))
    .filter((l) => l.distanceKm <= radiusKm)
    .filter((l) => priceMin === null || price(l) >= priceMin)
    .filter((l) => priceMax === null || price(l) <= priceMax)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return { spaces };
}

/** Answer an API request from the snapshot. Returns null when demo mode is off. */
export function demoResponse(input: RequestInfo | URL, init?: RequestInit): Response | null {
  if (!DEMO_MODE) return null;
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, "http://demo.local");
  const path = url.pathname.replace(/\/+$/, "");
  const method = (init?.method ?? "GET").toUpperCase();

  if (method !== "GET") return json({ message: DEMO_MESSAGE }, 403);

  if (path === "/api/config") return json(data.config);
  if (path === "/api/listings/search") return json(search(url.searchParams));

  const listing = path.match(/^\/api\/listings\/([^/]+)$/);
  if (listing) {
    const found = listings.find((l) => l.id === listing[1]);
    return found ? json({ listing: found }) : json({ message: "Listing not found" }, 404);
  }

  const reviews = path.match(/^\/api\/reviews\/listing\/([^/]+)$/);
  if (reviews) return json({ reviews: (data.reviews as Record<string, unknown[]>)[reviews[1]] ?? [] });

  // Everything else needs a signed-in user, which the demo never has.
  return json({ message: DEMO_MESSAGE }, 401);
}
