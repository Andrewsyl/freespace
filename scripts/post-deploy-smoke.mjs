const baseUrl = process.env.SMOKE_BASE_URL;

if (!baseUrl) {
  console.error("SMOKE_BASE_URL is required");
  process.exit(1);
}

const checks = [
  { name: "health", path: "/health" },
  { name: "root", path: "/" },
  { name: "legal index", path: "/legal" },
  { name: "listing search", path: "/api/listings/search?lat=53.3498&lng=-6.2603&radiusKm=1&from=2026-03-20T10:00:00.000Z&to=2026-03-20T12:00:00.000Z" },
  { name: "auth me unauthorized", path: "/api/auth/me", expectedStatus: 401 },
  { name: "bookings me unauthorized", path: "/api/bookings/me", expectedStatus: 401 },
];

for (const check of checks) {
  const response = await fetch(`${baseUrl}${check.path}`);
  const expectedStatus = check.expectedStatus ?? 200;
  if (response.status !== expectedStatus) {
    console.error(`Smoke check failed: ${check.name} -> expected ${expectedStatus}, got ${response.status}`);
    process.exit(1);
  }
}

console.log(`Post-deploy smoke checks passed for ${baseUrl}`);
