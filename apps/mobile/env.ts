import Constants from "expo-constants";

const must = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const apiBase = must(process.env.EXPO_PUBLIC_API_BASE, "EXPO_PUBLIC_API_BASE");
const stripeKey = must(
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
);
const appEnv =
  (Constants.expoConfig as { extra?: { appEnv?: string } } | null)?.extra?.appEnv?.trim().toLowerCase() ??
  process.env.APP_ENV?.trim().toLowerCase() ??
  (__DEV__ ? "local" : "production");
const postHogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

if (!/^https?:\/\//.test(apiBase)) {
  throw new Error("EXPO_PUBLIC_API_BASE must be an absolute URL");
}

if (!/^pk_(test|live)_/.test(stripeKey)) {
  throw new Error("EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY must look like a Stripe publishable key");
}

if (appEnv === "production" && !apiBase.startsWith("https://")) {
  throw new Error("Production EXPO_PUBLIC_API_BASE must use https");
}

if (appEnv === "production" && /^https?:\/\/(127\.0\.0\.1|localhost)/.test(apiBase)) {
  throw new Error("Production EXPO_PUBLIC_API_BASE cannot point at localhost");
}

if (appEnv !== "production" && stripeKey.startsWith("pk_live_")) {
  throw new Error("Live Stripe publishable keys are not allowed outside production");
}

// Production builds must use a live key so a forgotten test→live swap can't
// ship. Internal production-like builds (the eas.json "preview" profile) opt
// out explicitly via EXPO_PUBLIC_ALLOW_TEST_PAYMENTS=true.
const allowTestPayments = process.env.EXPO_PUBLIC_ALLOW_TEST_PAYMENTS === "true";
if (appEnv === "production" && !allowTestPayments && !stripeKey.startsWith("pk_live_")) {
  throw new Error(
    "Production builds require a live Stripe publishable key (or EXPO_PUBLIC_ALLOW_TEST_PAYMENTS=true for internal builds)"
  );
}

export const mobileEnv = {
  apiBase,
  appEnv,
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  googleOauthClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
  postHogKey,
  sentryDsn,
  stripePublishableKey: stripeKey,
} as const;
