import "./loadEnv.js";
import { z } from "zod";

const stringBool = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

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

const intervalSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("NOTIFICATION_PROCESSOR_INTERVAL_MS must be a positive number");
    }
    return parsed;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  WEB_BASE_URL: z.string().url("WEB_BASE_URL must be a valid URL").optional(),
  STRIPE_SECRET_KEY: z
    .string()
    .optional()
    .refine((value) => !value || /^sk_(test|live)_/.test(value), "STRIPE_SECRET_KEY must look like a Stripe secret key"),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .refine((value) => !value || value.startsWith("whsec_"), "STRIPE_WEBHOOK_SECRET must start with whsec_"),
  STRIPE_CONNECT_ENABLED: stringBool,
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  ENFORCE_HTTPS: stringBool,
  PORT: portSchema,
  NOTIFICATION_PROCESSOR_INTERVAL_MS: intervalSchema,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid API environment: ${details}`);
}

export const env = parsed.data;
