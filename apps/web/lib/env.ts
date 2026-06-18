import { z } from "zod";

function isLocalApiBase(url: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
    url
  );
}

const webEnvSchema = z
  .object({
    NEXT_PUBLIC_API_BASE: z.string().url("NEXT_PUBLIC_API_BASE must be a valid URL"),
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required"),
    NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
      .string()
      .optional()
      .refine(
        (value) => !value || /^pk_(test|live)_/.test(value),
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must look like a Stripe publishable key"
      ),
    BASIC_AUTH_USER: z.string().optional(),
    BASIC_AUTH_PASS: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    const apiUsesLocalNetwork = isLocalApiBase(value.NEXT_PUBLIC_API_BASE);
    if (!apiUsesLocalNetwork && !value.NEXT_PUBLIC_API_BASE.startsWith("https://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_API_BASE"],
        message: "NEXT_PUBLIC_API_BASE must use https outside localhost",
      });
    }
    if (value.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_") && apiUsesLocalNetwork) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
        message: "Live web Stripe keys cannot be used with localhost API bases",
      });
    }
    if (value.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_") && !value.NEXT_PUBLIC_API_BASE.startsWith("https://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
        message: "Live web Stripe keys require an https API base",
      });
    }
  });

const candidateEnv = {
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  BASIC_AUTH_USER: process.env.BASIC_AUTH_USER,
  BASIC_AUTH_PASS: process.env.BASIC_AUTH_PASS,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
};

const parsed = webEnvSchema.safeParse(candidateEnv);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid web environment: ${details}`);
}

export const webEnv = parsed.data;
