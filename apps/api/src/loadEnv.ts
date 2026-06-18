import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load env files (root and api-local) for local development only.
// In production (e.g. Elastic Beanstalk), environment variables should come from the host.
const rootEnv = path.resolve(__dirname, "../../../.env");
const rootEnvLocal = path.resolve(__dirname, "../../../.env.local");
const apiEnv = path.resolve(__dirname, "../.env");
const apiEnvLocal = path.resolve(__dirname, "../.env.local");

if (process.env.NODE_ENV !== "production") {
  // Load in order, allowing later files to override earlier ones.
  dotenv.config({ path: rootEnv });
  dotenv.config({ path: rootEnvLocal, override: true });
  dotenv.config({ path: apiEnv, override: true });
  dotenv.config({ path: apiEnvLocal, override: true });
}

// --- Stripe mode switch ------------------------------------------------------
// Lets prod flip between Stripe test and live without copy-pasting keys: store
// BOTH pairs once (STRIPE_LIVE_* and STRIPE_TEST_*) and set STRIPE_MODE=live|test.
// The selected pair is copied into the canonical STRIPE_SECRET_KEY /
// STRIPE_WEBHOOK_SECRET / STRIPE_CONNECT_WEBHOOK_SECRET that the rest of the app
// reads. If STRIPE_MODE is unset the canonical vars are used as-is (so existing
// deployments keep working unchanged). Runs in every environment, after dotenv.
const stripeMode = process.env.STRIPE_MODE?.trim().toLowerCase();
if (stripeMode) {
  if (stripeMode !== "live" && stripeMode !== "test") {
    throw new Error(`STRIPE_MODE must be "live" or "test" (got "${process.env.STRIPE_MODE}").`);
  }
  const prefix = stripeMode === "live" ? "STRIPE_LIVE_" : "STRIPE_TEST_";
  const secret = process.env[`${prefix}SECRET_KEY`];
  const webhook = process.env[`${prefix}WEBHOOK_SECRET`];
  const connectWebhook = process.env[`${prefix}CONNECT_WEBHOOK_SECRET`];

  if (!secret) {
    throw new Error(`STRIPE_MODE=${stripeMode} but ${prefix}SECRET_KEY is not set.`);
  }
  const expectedKeyPrefix = stripeMode === "live" ? "sk_live_" : "sk_test_";
  if (!secret.startsWith(expectedKeyPrefix)) {
    throw new Error(
      `${prefix}SECRET_KEY must start with "${expectedKeyPrefix}" for STRIPE_MODE=${stripeMode} ` +
        "(the live/test keys look swapped)."
    );
  }

  process.env.STRIPE_SECRET_KEY = secret;
  if (webhook) process.env.STRIPE_WEBHOOK_SECRET = webhook;
  if (connectWebhook) process.env.STRIPE_CONNECT_WEBHOOK_SECRET = connectWebhook;
}
