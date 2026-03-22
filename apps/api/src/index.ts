import "./loadEnv.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as Sentry from "@sentry/node";
import { createApp } from "./app.js";
import { processScheduledNotifications } from "./lib/notifications.js";
import { reportOperationalAlert } from "./lib/opsAlerts.js";
import { pool } from "./lib/db.js";
import { env } from "./env.js";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

const app = createApp();
const port = env.PORT;

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  void logRuntimeHealthChecks();
});

process.on("unhandledRejection", (reason) => {
  console.error("[process] Unhandled rejection", reason);
  Sentry.captureException(reason);
  void reportOperationalAlert({
    source: "api-process",
    title: "Unhandled promise rejection",
    payload: {
      reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason),
    },
  });
});

process.on("uncaughtException", (error) => {
  console.error("[process] Uncaught exception", error);
  Sentry.captureException(error);
  void reportOperationalAlert({
    source: "api-process",
    title: "Uncaught exception",
    payload: {
      message: error.message,
      stack: error.stack,
    },
  });
});

if (env.NOTIFICATION_PROCESSOR_INTERVAL_MS) {
  setInterval(() => {
    void processScheduledNotifications(50);
  }, env.NOTIFICATION_PROCESSOR_INTERVAL_MS);
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
        AND column_name IN ('full_name', 'phone', 'vehicle_make', 'vehicle_type', 'vehicle_color', 'vehicle_plate')
      `
    );
    const present = new Set(hasColumns.rows.map((r: { column_name: string }) => r.column_name));
    const missing = ["full_name", "phone", "vehicle_make", "vehicle_type", "vehicle_color", "vehicle_plate"].filter((col) => !present.has(col));
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

export { app };
