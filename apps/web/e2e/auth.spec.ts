import { expect, test } from "@playwright/test";

test("login page renders auth controls", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("reset password request flow shows success notice", async ({ page }) => {
  await page.route("**/api/auth/request-password-reset", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, previewUrl: "https://freespace.ie/reset-password?token=test-reset-token-12345" }),
    });
  });

  await page.goto("/reset-password");

  await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();
  await page.getByLabel("Email address").fill("driver@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText("Check your inbox")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open reset link" })).toBeVisible();
});

test("reset password form submits a new password", async ({ page }) => {
  await page.route("**/api/auth/reset-password", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/reset-password?token=test-reset-token-12345");

  await page.getByLabel("New password").fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Set new password" }).click();

  await expect(page).toHaveURL(/\/login$/);
});
