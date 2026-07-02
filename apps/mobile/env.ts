import Constants from "expo-constants";
import { NativeModules } from "react-native";

const must = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const configuredApiBase = must(process.env.EXPO_PUBLIC_API_BASE, "EXPO_PUBLIC_API_BASE");
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

function getDevBundleHost() {
  const candidates = [
    NativeModules.SourceCode?.scriptURL,
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate.includes("://") ? candidate : `http://${candidate}`);
      const host = parsed.hostname?.trim();
      if (host && host !== "127.0.0.1" && host !== "localhost") {
        return host;
      }
    } catch {
      // Ignore malformed dev URLs and fall through to the configured host.
    }
  }

  return null;
}

function resolveApiBase(apiBase: string) {
  if (appEnv !== "local") return apiBase;
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(apiBase)) return apiBase;

  const bundleHost = getDevBundleHost();
  if (!bundleHost) return apiBase;

  try {
    const parsed = new URL(apiBase);
    parsed.hostname = bundleHost;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return apiBase;
  }
}

const apiBase = resolveApiBase(configuredApiBase);

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

const isLocalApiBase =
  /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(apiBase) ||
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/i.test(apiBase) ||
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/i.test(apiBase) ||
  /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/i.test(apiBase);

if (appEnv === "local" && !isLocalApiBase) {
  throw new Error("Local EXPO_PUBLIC_API_BASE must point at localhost or a private LAN host");
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
