import "./loadEnv.js";
import { z } from "zod";

const optionalStringBool = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value == null ? undefined : value === "true"));

const portSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return 8080;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("PORT must be a positive number");
    }
    return parsed;
  });

const makeIntervalSchema = (name: string) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive number`);
      }
      return parsed;
    });

const intervalSchema = makeIntervalSchema("NOTIFICATION_PROCESSOR_INTERVAL_MS");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    WEB_BASE_URL: z.string().url("WEB_BASE_URL must be a valid URL").optional(),
    STRIPE_SECRET_KEY: z
      .string()
      .optional()
      .refine(
        (value) => !value || /^sk_(test|live)_/.test(value),
        "STRIPE_SECRET_KEY must look like a Stripe secret key"
      ),
    // Served to the mobile app via GET /api/config so the publishable key (and
    // therefore test/live mode) is a server-side switch, not a value baked into
    // the app binary — flip this + STRIPE_SECRET_KEY together and restart, no
    // app rebuild or store review needed.
    STRIPE_PUBLISHABLE_KEY: z
      .string()
      .optional()
      .refine(
        (value) => !value || /^pk_(test|live)_/.test(value),
        "STRIPE_PUBLISHABLE_KEY must look like a Stripe publishable key"
      ),
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .optional()
      .refine((value) => !value || value.startsWith("whsec_"), "STRIPE_WEBHOOK_SECRET must start with whsec_"),
    RESEND_API_KEY: z
      .string()
      .optional()
      .refine((value) => !value || value.startsWith("re_"), "RESEND_API_KEY must look like a Resend API key"),
    POSTHOG_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    STRIPE_CONNECT_ENABLED: optionalStringBool.transform((value) => value ?? false),
    ERROR_REPORT_WEBHOOK_URL: z.string().url("ERROR_REPORT_WEBHOOK_URL must be a valid URL").optional(),
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_IOS_CLIENT_ID: z.string().optional(),
    FACEBOOK_APP_ID: z.string().optional(),
    FACEBOOK_APP_SECRET: z.string().optional(),
    ENFORCE_HTTPS: optionalStringBool,
    ALLOW_TEST_STRIPE_KEYS_IN_PRODUCTION: optionalStringBool,
    PORT: portSchema,
    NOTIFICATION_PROCESSOR_INTERVAL_MS: intervalSchema,
    BOOKING_SWEEPER_INTERVAL_MS: makeIntervalSchema("BOOKING_SWEEPER_INTERVAL_MS"),
  })
  .superRefine((value, ctx) => {
    const stripeMode = value.STRIPE_SECRET_KEY?.startsWith("sk_live_")
      ? "live"
      : value.STRIPE_SECRET_KEY?.startsWith("sk_test_")
        ? "test"
        : null;

    if (value.NODE_ENV === "production") {
      if (!value.WEB_BASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WEB_BASE_URL"],
          message: "WEB_BASE_URL is required in production",
        });
      } else if (!value.WEB_BASE_URL.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WEB_BASE_URL"],
          message: "WEB_BASE_URL must use https in production",
        });
      }

    }

    if (stripeMode === "live" && value.NODE_ENV !== "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_SECRET_KEY"],
        message: "Live Stripe secret keys are only allowed in production",
      });
    }

    // The inverse guard: a production API must run live Stripe keys so a
    // forgotten test→live swap fails loudly at boot instead of taking fake
    // money. Pre-launch/staging boxes opt out explicitly via
    // ALLOW_TEST_STRIPE_KEYS_IN_PRODUCTION=true.
    if (
      value.NODE_ENV === "production" &&
      stripeMode === "test" &&
      !value.ALLOW_TEST_STRIPE_KEYS_IN_PRODUCTION
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_SECRET_KEY"],
        message:
          "Production requires a live Stripe secret key (set ALLOW_TEST_STRIPE_KEYS_IN_PRODUCTION=true to override pre-launch)",
      });
    }

    if (value.NODE_ENV === "production" && value.STRIPE_SECRET_KEY && !value.STRIPE_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_WEBHOOK_SECRET"],
        message: "STRIPE_WEBHOOK_SECRET is required when Stripe is configured in production",
      });
    }

    const publishableMode = value.STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")
      ? "live"
      : value.STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")
        ? "test"
        : null;

    if (value.STRIPE_SECRET_KEY && value.STRIPE_PUBLISHABLE_KEY && stripeMode !== publishableMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_PUBLISHABLE_KEY"],
        message: "STRIPE_PUBLISHABLE_KEY must be in the same mode (test/live) as STRIPE_SECRET_KEY",
      });
    }

    if (value.NODE_ENV === "production" && value.STRIPE_SECRET_KEY && !value.STRIPE_PUBLISHABLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_PUBLISHABLE_KEY"],
        message: "STRIPE_PUBLISHABLE_KEY is required when Stripe is configured in production",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid API environment: ${details}`);
}

export const env = {
  ...parsed.data,
  ENFORCE_HTTPS: parsed.data.ENFORCE_HTTPS ?? parsed.data.NODE_ENV === "production",
};
