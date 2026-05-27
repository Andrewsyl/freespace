import { expect, test } from "@playwright/test";

const SEARCH_URL =
  "/search?location=Dublin%20City%20Centre&lat=53.3498&lng=-6.2603&date=2026-05-27&startTime=09:00&endTime=11:00&radiusKm=5";

const spaces = [
  {
    id: "listing-1",
    title: "Mountjoy Square Parking",
    address: "Mountjoy Square, Dublin 1",
    pricePerDay: 11,
    rating: 4.8,
    ratingCount: 32,
    distanceKm: 0.4,
    availability: "available",
    amenities: ["CCTV", "Covered", "Instant book"],
    tags: ["driveway"],
    latitude: 53.3532,
    longitude: -6.2591,
  },
  {
    id: "listing-2",
    title: "Docklands Secure Space",
    address: "Mayor Street Lower, Dublin 1",
    pricePerDay: 14,
    rating: 4.6,
    ratingCount: 19,
    distanceKm: 1.2,
    availability: "available",
    amenities: ["Gated"],
    tags: ["car park"],
    latitude: 53.3489,
    longitude: -6.2432,
  },
];

test("search results render and a listing overlay can open and close", async ({ page }) => {
  await page.route("**/api/listings/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ spaces }),
    });
  });

  await page.goto(SEARCH_URL);

  await expect(page.getByRole("heading", { name: "2 spaces near Dublin City Centre" })).toBeVisible();
  await expect(page.getByText("Mountjoy Square Parking")).toBeVisible();
  await expect(page.getByText("Docklands Secure Space")).toBeVisible();

  await page.getByText("Mountjoy Square Parking").click();

  await expect(page.getByRole("button", { name: "Close space details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mountjoy Square Parking" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Book now securely" })).toBeVisible();

  await page.getByRole("button", { name: "Close space details" }).click();

  await expect(page.getByRole("button", { name: "Close space details" })).not.toBeVisible();
  await expect(page.getByText("Docklands Secure Space")).toBeVisible();
});

test("search empty state renders when no spaces match", async ({ page }) => {
  await page.route("**/api/listings/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ spaces: [] }),
    });
  });

  await page.goto(SEARCH_URL);

  await expect(page.getByText("No spaces found")).toBeVisible();
  await expect(page.getByText("We couldn't find any spaces near Dublin City Centre.")).toBeVisible();
});

test("search API failures surface a visible error", async ({ page }) => {
  await page.route("**/api/listings/search?*", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Search service unavailable" }),
    });
  });

  await page.goto(SEARCH_URL);

  await expect(page.getByText("Search service unavailable")).toBeVisible();
});
