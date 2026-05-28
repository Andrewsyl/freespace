import { expect, test } from "@playwright/test";

test("home renders primary search CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Find parking spaces" })).toBeVisible();
});

test("legal page renders", async ({ page }) => {
  await page.goto("/legal");
  await expect(
    page.getByRole("heading", { name: "Policies, terms, and operating rules" })
  ).toBeVisible();
  await expect(page.locator('a[href="/legal/cookie-policy"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "← Back to FreeSpace" })).toBeVisible();
});
