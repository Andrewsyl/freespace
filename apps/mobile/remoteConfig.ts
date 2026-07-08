import { mobileEnv } from "./env";

const FETCH_TIMEOUT_MS = 4000;
const STRIPE_PLACEHOLDER_KEY_PREFIX = "pk_test_localdummy";

// The publishable key baked into this build (mobileEnv.stripePublishableKey)
// is only the offline fallback. The server is the real switch: flipping
// STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY there moves every installed app
// between Stripe test and live mode without a rebuild or store review.
export async function resolveStripePublishableKey(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${mobileEnv.apiBase}/api/config`, { signal: controller.signal });
      if (!response.ok) throw new Error(`config fetch failed: ${response.status}`);
      const data = (await response.json()) as { stripePublishableKey?: string | null };
      if (
        data.stripePublishableKey &&
        /^pk_(test|live)_/.test(data.stripePublishableKey) &&
        !data.stripePublishableKey.startsWith(STRIPE_PLACEHOLDER_KEY_PREFIX)
      ) {
        return data.stripePublishableKey;
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Offline, timed out, or the server hasn't been configured yet — fall
    // back to the baked-in key so the app still starts.
  }
  return mobileEnv.stripePublishableKey;
}
