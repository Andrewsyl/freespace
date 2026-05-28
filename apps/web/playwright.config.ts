import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command:
      "NEXT_PUBLIC_API_BASE=http://127.0.0.1:4000 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=test NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_123 NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=test PORT=3100 HOSTNAME=127.0.0.1 node .next/standalone/apps/web/server.js",
    port: 3100,
    reuseExistingServer: !process.env.CI,
    cwd: process.cwd(),
    timeout: 120000,
  },
});
