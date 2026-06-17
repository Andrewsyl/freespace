// Shared Google Pay config for Stripe's PaymentSheet (initPaymentSheet).
//
// Important: `testEnv` must match the *Stripe key mode*, not the build type.
// Using `__DEV__` previously meant a production build running on Stripe TEST
// keys requested Google's *production* wallet, which failed and crashed the
// sheet ("Failed to retrieve a PaymentSheetResult"). Tying it to the publishable
// key keeps the wallet environment and the Stripe environment in sync.
const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

// Google Pay is a NATIVE feature (needs the wallet meta-data + plugin compiled
// in). It cannot be tested via a Metro reload, and if it fails it takes down the
// whole payment sheet. So it stays OFF until verified on a fresh native build —
// flip this to true once a real Android build confirms Google Pay works, then
// it ships. While false, `googlePayConfig` is undefined and the sheet ignores it.
export const GOOGLE_PAY_ENABLED = true;

export const googlePayConfig = GOOGLE_PAY_ENABLED
  ? ({
      merchantCountryCode: "IE",
      currencyCode: "EUR",
      testEnv: STRIPE_PK.startsWith("pk_test_"),
    } as const)
  : undefined;
