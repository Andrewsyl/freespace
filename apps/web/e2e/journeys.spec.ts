import { expect, test } from "@playwright/test";

const authSession = {
  token: "test.token.value",
  user: {
    id: "user-1",
    email: "host@example.com",
    role: "host",
    emailVerified: true,
  },
};

const hostDraft = {
  address: "33 Mountjoy Square, Dublin 1",
  latitude: 53.3551,
  longitude: -6.2587,
  locationConfirmed: true,
  coverHeading: 12,
  coverPitch: 18,
  spaceType: "Private Driveway",
  spaceCount: "1",
  vehicleSize: "medium",
  title: "Private Driveway near Mountjoy Square",
  availabilityText: "Available daily from 08:00 to 20:00",
  requiresAccessCode: false,
  accessInstructions: "",
  pricingMode: "both",
  pricePerHour: 2,
  pricePerDay: 12,
  pricePerMonth: 100,
  amenities: ["CCTV", "Well lit"],
  imageUrls: ["https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80"],
};

function seedSignedInSession(page: Parameters<typeof test>[0]["page"]) {
  return page.addInitScript((session) => {
    window.localStorage.setItem("auth_token", session.token);
    window.localStorage.setItem("auth_user", JSON.stringify(session.user));
    window.localStorage.setItem("freespace_cookie_consent", "accepted");
  }, authSession);
}

test("signed-in driver can start a booking checkout", async ({ page, baseURL }) => {
  await seedSignedInSession(page);
  let bookingRequestSeen = false;

  await page.route("**/api/listings/listing-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        listing: {
          id: "listing-1",
          title: "Mountjoy Square Parking",
          address: "Mountjoy Square, Dublin 1",
          pricePerDay: 11,
          rateType: "daily",
          availability: "available",
          hostStripeAccountId: "acct_live_123",
          amenities: ["CCTV"],
        },
      }),
    });
  });

  await page.route("**/api/bookings", async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    bookingRequestSeen = true;

    expect(request.headers().authorization).toBe("Bearer test.token.value");
    expect(body.listingId).toBe("listing-1");
    expect(body.amountCents === null || body.amountCents > 0).toBe(true);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        checkoutUrl: `${baseURL}/booking/success`,
        sessionId: "cs_test_123",
      }),
    });
  });

  await page.goto("/checkout/listing-1");

  await expect(page.getByRole("heading", { name: "Mountjoy Square Parking" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contact Info" })).toBeVisible();
  await expect(page.getByText("Reservation Period")).toBeVisible();

  await page.evaluate(() => {
    const form = document.getElementById("checkout-form") as HTMLFormElement | null;
    form?.requestSubmit();
  });
  await expect.poll(() => bookingRequestSeen).toBe(true);
});

test("signed-in host can publish a space from the wizard", async ({ page }) => {
  await page.addInitScript(({ session, draft }) => {
    window.localStorage.setItem("auth_token", session.token);
    window.localStorage.setItem("auth_user", JSON.stringify(session.user));
    window.localStorage.setItem("host-listing-draft", JSON.stringify(draft));
    window.localStorage.setItem("freespace_cookie_consent", "accepted");
  }, { session: authSession, draft: hostDraft });

  await page.route("**/api/listings", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    const body = route.request().postDataJSON();
    expect(body.address).toBe(hostDraft.address);
    expect(body.pricePerDay).toBe(12);
    expect(body.pricePerMonth).toBe(100);
    expect(body.amenities).toContain("CCTV");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "listing-created-1" }),
    });
  });

  await page.goto("/host");

  await expect(page.getByRole("heading", { name: "Confirm location" })).toBeVisible();

  for (let step = 0; step < 7; step += 1) {
    await page.getByRole("button", { name: "Continue" }).click();
  }

  await expect(page.getByRole("button", { name: "Publish listing" })).toBeVisible();
  await page.getByRole("button", { name: "Publish listing" }).click();

  await page.waitForURL("**/host/dashboard?created=1");
});
