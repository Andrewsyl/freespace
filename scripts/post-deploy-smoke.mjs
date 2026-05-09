const baseUrl = process.env.SMOKE_BASE_URL;
const mode = process.env.SMOKE_MODE ?? "api";

if (!baseUrl) {
  console.error("SMOKE_BASE_URL is required");
  process.exit(1);
}

const searchPath =
  "/api/listings/search?lat=53.3498&lng=-6.2603&radiusKm=1&from=2026-03-20T10:00:00.000Z&to=2026-03-20T12:00:00.000Z";

const checksByMode = {
  api: [
    { name: "health", path: "/health" },
    { name: "root", path: "/" },
    { name: "listing search", path: searchPath, validateJson: "searchResults" },
    { name: "auth me unauthorized", path: "/api/auth/me", expectedStatus: 401 },
    { name: "bookings me unauthorized", path: "/api/bookings/me", expectedStatus: 401 },
  ],
  web: [
    { name: "root", path: "/" },
    { name: "legal index", path: "/legal" },
    { name: "legal terms", path: "/legal/terms-of-service" },
    { name: "contact", path: "/contact" },
    { name: "login", path: "/login" },
  ],
};

const checks = checksByMode[mode];

if (!checks) {
  console.error(`Unsupported SMOKE_MODE: ${mode}`);
  process.exit(1);
}

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

let listingSearchResult = null;

for (const check of checks) {
  const response = await fetch(`${baseUrl}${check.path}`);
  const expectedStatus = check.expectedStatus ?? 200;
  if (response.status !== expectedStatus) {
    console.error(`Smoke check failed: ${check.name} -> expected ${expectedStatus}, got ${response.status}`);
    process.exit(1);
  }

  if (check.validateJson === "searchResults") {
    const json = await parseJsonSafely(response);
    const spaces = Array.isArray(json?.spaces) ? json.spaces : [];
    if (spaces.length === 0) {
      console.error("Smoke check failed: listing search returned no spaces");
      process.exit(1);
    }
    const listingId = spaces[0]?.id;
    if (!listingId) {
      console.error("Smoke check failed: first search result is missing an id");
      process.exit(1);
    }
    listingSearchResult = { listingId };
  }
}

if (mode === "api" && listingSearchResult) {
  const detailUrl =
    `${baseUrl}/api/listings/${listingSearchResult.listingId}` +
    "?from=2026-03-20T10:00:00.000Z&to=2026-03-20T12:00:00.000Z";
  const response = await fetch(detailUrl);
  if (response.status !== 200) {
    console.error(`Smoke check failed: listing detail -> expected 200, got ${response.status}`);
    process.exit(1);
  }
  const json = await parseJsonSafely(response);
  if (!json?.listing?.id || !json?.listing?.title) {
    console.error("Smoke check failed: listing detail payload is missing required fields");
    process.exit(1);
  }
}

console.log(`Post-deploy smoke checks passed for ${baseUrl} (${mode})`);
