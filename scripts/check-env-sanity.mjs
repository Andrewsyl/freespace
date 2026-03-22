import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

const root = process.cwd();
const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg ? modeArg.split("=")[1] : "local";

const loadIfExists = (filePath) => {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: true });
  }
};

loadIfExists(path.join(root, ".env"));
loadIfExists(path.join(root, ".env.local"));
loadIfExists(path.join(root, "apps/api/.env"));
loadIfExists(path.join(root, `apps/api/.env.${mode}`));
loadIfExists(path.join(root, "apps/web/.env.local"));
loadIfExists(path.join(root, "apps/mobile/.env"));
loadIfExists(
  path.join(root, "apps/mobile", mode === "local" ? ".env.local.source" : `.env.${mode}`)
);

const apiBaseExpected =
  mode === "production" ? /^https:\/\// : /^https?:\/\/(127\.0\.0\.1|localhost|.+)/;

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  WEB_BASE_URL: z.string().url(),
  ENFORCE_HTTPS: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_API_BASE: z.string().url(),
  EXPO_PUBLIC_API_BASE: z.string().url().regex(apiBaseExpected, "Unexpected mobile API base for selected mode"),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  EXPO_PUBLIC_SENTRY_DSN: z.string().url("Invalid mobile Sentry DSN").optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().regex(/^pk_(test|live)_/, "Invalid web Stripe publishable key").optional(),
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().regex(/^pk_(test|live)_/, "Invalid mobile Stripe publishable key"),
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_/, "Invalid API Stripe secret key").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_/, "Invalid Stripe webhook secret").optional(),
  SENTRY_DSN: z.string().url("Invalid Sentry DSN").optional(),
  ERROR_REPORT_WEBHOOK_URL: z.string().url("Invalid error reporting webhook URL").optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Environment validation failed:");
  for (const issue of parsed.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;
const mobileUsesLocal = /127\.0\.0\.1|localhost/.test(env.EXPO_PUBLIC_API_BASE);
const webAndMobileStripeMismatch =
  env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
  env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.split("_")[1] !==
  env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY.split("_")[1];
const stripeSecretMode = env.STRIPE_SECRET_KEY?.split("_")[1] ?? null;
const webStripeMode = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.split("_")[1] ?? null;
const mobileStripeMode = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY.split("_")[1];

if (mode === "production" && mobileUsesLocal) {
  console.error("Production mode cannot point mobile at localhost/127.0.0.1");
  process.exit(1);
}

if (webAndMobileStripeMismatch) {
  console.error("Web and mobile Stripe publishable keys are not in the same mode (test/live).");
  process.exit(1);
}

if (stripeSecretMode && stripeSecretMode !== mobileStripeMode) {
  console.error("API Stripe secret key and mobile Stripe publishable key are not in the same mode (test/live).");
  process.exit(1);
}

if (stripeSecretMode && webStripeMode && stripeSecretMode !== webStripeMode) {
  console.error("API Stripe secret key and web Stripe publishable key are not in the same mode (test/live).");
  process.exit(1);
}

if (mode !== "production" && stripeSecretMode === "live") {
  console.error("Live Stripe secret keys are not allowed outside production mode.");
  process.exit(1);
}

if (mode === "production") {
  if (!env.WEB_BASE_URL.startsWith("https://")) {
    console.error("Production WEB_BASE_URL must use https.");
    process.exit(1);
  }
  if (env.ENFORCE_HTTPS !== "true") {
    console.error("Production mode requires ENFORCE_HTTPS=true.");
    process.exit(1);
  }
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
    console.error("Production Stripe configuration requires STRIPE_WEBHOOK_SECRET.");
    process.exit(1);
  }
}

console.log(`Environment sanity checks passed for mode=${mode}`);
