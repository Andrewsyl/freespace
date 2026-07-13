import { mobileEnv } from "./env";
import { setPlatformFeeSchedule, type PlatformFeeSchedule } from "./utils/pricing";
import { setPriceSuggestionConfig, type PriceSuggestionConfig } from "./utils/priceSuggestions";

const FETCH_TIMEOUT_MS = 4000;
const STRIPE_PLACEHOLDER_KEY_PREFIX = "pk_test_localdummy";

// The publishable key baked into this build (mobileEnv.stripePublishableKey)
// is only the offline fallback. The server is the real switch: flipping
// STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY there moves every installed app
// between Stripe test and live mode without a rebuild or store review.
// The platform fee schedule rides the same fetch: the server prices bookings
// from its env schedule, and utils/pricing.ts must quote with the same values
// or every booking 400s "price out of date". A failed fetch keeps the baked-in
// defaults, which match the server's env defaults.
export async function resolveStripePublishableKey(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${mobileEnv.apiBase}/api/config`, { signal: controller.signal });
      if (!response.ok) throw new Error(`config fetch failed: ${response.status}`);
      const data = (await response.json()) as {
        stripePublishableKey?: string | null;
        pricing?: Partial<PlatformFeeSchedule> | null;
        priceSuggestions?: Partial<PriceSuggestionConfig> | null;
      };
      setPlatformFeeSchedule(data.pricing);
      // Advisory host price suggestions ride the same fetch; a miss just
      // leaves the baked-in default zone table in place.
      setPriceSuggestionConfig(data.priceSuggestions);
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
