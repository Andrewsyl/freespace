import { expect, test } from "@playwright/test";

test("host page shows onboarding guidance when signed out", async ({ page }) => {
  await page.goto("/host");

  await expect(page.getByRole("heading", { name: "Sign in to get started" })).toBeVisible();
  await expect(page.getByText("You need an account to list your parking space.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});
