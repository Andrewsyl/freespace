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

if (!/^https?:\/\//.test(apiBase)) {
  throw new Error("EXPO_PUBLIC_API_BASE must be an absolute URL");
}

if (!/^pk_(test|live)_/.test(stripeKey)) {
  throw new Error("EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY must look like a Stripe publishable key");
}

export const mobileEnv = {
  apiBase,
  appEnv: process.env.APP_ENV,
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  googleOauthClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
  stripePublishableKey: stripeKey,
} as const;
