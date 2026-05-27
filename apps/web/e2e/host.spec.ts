import { expect, test } from "@playwright/test";

test("host page shows onboarding guidance when signed out", async ({ page }) => {
  await page.goto("/host");

  await expect(page.getByRole("heading", { name: "List your space" })).toBeVisible();
  await expect(page.getByText("Sign in to start earning from your parking space.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});
