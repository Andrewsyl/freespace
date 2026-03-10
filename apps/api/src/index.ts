import "./loadEnv.js";
import cors from "cors";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth.js";
import bookingsRouter from "./routes/bookings.js";
import listingsRouter from "./routes/listings.js";
import favoritesRouter from "./routes/favorites.js";
import reviewsRouter from "./routes/reviews.js";
import { z } from "zod";
import hostRouter from "./routes/host.js";
import adminRouter from "./routes/admin.js";
import paymentsRouter from "./routes/payments.js";
import supportRouter from "./routes/support.js";
import notificationsRouter from "./routes/notifications.js";
import { processScheduledNotifications } from "./lib/notifications.js";
import { csrfProtection } from "./middleware/csrf.js";
import { pool } from "./lib/db.js";

const app = express();
// Trust proxy so req.secure works behind load balancers.
app.set("trust proxy", 1);

if (process.env.ENFORCE_HTTPS === "true") {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
      }
      return next();
    }
    const host = req.headers.host ?? "";
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}
const allowedOrigins = new Set(
  [
    process.env.WEB_BASE_URL,
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
  ].filter(Boolean)
);
const allowAllOriginsInDev = process.env.NODE_ENV !== "production";
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowAllOriginsInDev) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("CORS blocked"));
    },
  })
);
app.use(csrfProtection);
// Skip JSON parsing for Stripe webhook route so we can validate the raw payload.
app.use((req, res, next) => {
  if (req.originalUrl === "/api/bookings/webhook") {
    return next();
  }
  return express.json()(req, res, next);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "freespace-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/host", hostRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/admin", adminRouter);
app.use("/api", paymentsRouter);
app.use("/api/support", supportRouter);
app.use("/api/notifications", notificationsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);

  if (err instanceof z.ZodError) {
    return res.status(422).json({
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
  }

  if (err instanceof Error) {
    const maybeStripeError = err as Error & {
      type?: string;
      message?: string;
      code?: string;
      param?: string;
      requestId?: string;
      statusCode?: number;
      rawType?: string;
      raw?: {
        message?: string;
        code?: string;
        param?: string;
        requestId?: string;
        type?: string;
      };
    };
    const stripeMessage = maybeStripeError.raw?.message ?? maybeStripeError.message;
    const stripeCode = maybeStripeError.raw?.code ?? maybeStripeError.code;
    const stripeParam = maybeStripeError.raw?.param ?? maybeStripeError.param;
    const stripeRequestId = maybeStripeError.raw?.requestId ?? maybeStripeError.requestId;
    const stripeType = maybeStripeError.raw?.type ?? maybeStripeError.rawType ?? maybeStripeError.type;
    if (
      maybeStripeError.type?.startsWith("Stripe") ||
      maybeStripeError.rawType === "invalid_request_error" ||
      maybeStripeError.raw?.type === "invalid_request_error" ||
      maybeStripeError.statusCode === 400
    ) {
      return res.status(400).json({
        message: stripeMessage ?? "Stripe request failed",
        code: stripeCode,
        param: stripeParam,
        type: stripeType,
        requestId: stripeRequestId,
      });
    }
    return res.status(500).json({ message: "Internal server error" });
  }

  res.status(500).json({ message: "An unexpected error occurred" });
});

const port = process.env.PORT ?? 8080;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  void logRuntimeHealthChecks();
});

if (process.env.NOTIFICATION_PROCESSOR_INTERVAL_MS) {
  const intervalMs = Number(process.env.NOTIFICATION_PROCESSOR_INTERVAL_MS);
  if (!Number.isNaN(intervalMs) && intervalMs > 0) {
    setInterval(() => {
      void processScheduledNotifications(50);
    }, intervalMs);
  }
}

async function logRuntimeHealthChecks() {
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error("[startup] Database connectivity check failed:", error);
    return;
  }

  try {
    const hasColumns = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('full_name', 'phone')
      `
    );
    const present = new Set(hasColumns.rows.map((r: { column_name: string }) => r.column_name));
    const missing = ["full_name", "phone"].filter((col) => !present.has(col));
    if (missing.length) {
      console.error(
        `[startup] Missing users columns: ${missing.join(", ")}. Run: npm --workspace apps/api run migrate`
      );
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const migrationsDir = path.resolve(__dirname, "../../../db/migrations");
    const allMigrations = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    const schemaMigrationsExists = await pool.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
      ) AS exists
      `
    );
    const exists = schemaMigrationsExists.rows[0]?.exists === true;
    if (!exists) {
      console.error("[startup] schema_migrations table missing. Run: npm --workspace apps/api run migrate");
      return;
    }
    const appliedRes = await pool.query("SELECT filename FROM schema_migrations");
    const applied = new Set(appliedRes.rows.map((r: { filename: string }) => r.filename));
    const pending = allMigrations.filter((f) => !applied.has(f));
    if (pending.length) {
      console.warn(
        `[startup] Pending migrations detected (${pending.length}). Latest pending: ${pending[pending.length - 1]}`
      );
    }
  } catch (error) {
    console.error("[startup] Runtime schema check failed:", error);
  }
}
