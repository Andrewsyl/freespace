import { expect, test } from "@playwright/test";

test("host page redirects a signed-out visitor to login", async ({ page }) => {
  await page.goto("/host");

  // Signed-out users are sent to the polished /login page (with a return path)
  // instead of a bare interstitial. Allow time for dev-mode route compilation.
  await page.waitForURL(/\/login\?next=/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
