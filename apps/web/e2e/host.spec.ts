import { expect, test } from "@playwright/test";

test("host page shows onboarding guidance when signed out", async ({ page }) => {
  await page.goto("/host");

  await expect(page.getByRole("heading", { name: "Become a host" })).toBeVisible();
  await expect(page.getByText("Sign in to add a new space.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to login" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
});
