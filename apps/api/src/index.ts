import "./loadEnv.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";
import { processScheduledNotifications } from "./lib/notifications.js";
import { sweepStalePendingBookings } from "./lib/bookingSweeper.js";
import { reportOperationalAlert } from "./lib/opsAlerts.js";
import { pool } from "./lib/db.js";
import { env } from "./env.js";
import { logError, logInfo, logWarn } from "./lib/logger.js";
import { initPostHog, captureException } from "./lib/posthog.js";

initPostHog();

const app = createApp();
const port = env.PORT;

const server = app.listen(port, () => {
  logInfo("api.started", {
    port,
    nodeEnv: env.NODE_ENV,
  });
  void logRuntimeHealthChecks();
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logError("api.port_in_use", {
      port,
      message: error.message,
    });
    if (env.NODE_ENV === "production") {
      void reportOperationalAlert({
        source: "api-process",
        title: "API port already in use",
        payload: {
          port,
          message: error.message,
        },
      });
    }
    process.exit(1);
  }

  throw error;
});

let lastUnhandledAlertKey = "";
let lastUnhandledAlertAt = 0;
const UNHANDLED_ALERT_COOLDOWN_MS = 5 * 60 * 1000;

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logError("process.unhandled_rejection", {
    reason: reason instanceof Error ? { message, stack: reason.stack } : message,
  });
  captureException(reason);
  const key = message.slice(0, 120);
  const now = Date.now();
  if (key === lastUnhandledAlertKey && now - lastUnhandledAlertAt < UNHANDLED_ALERT_COOLDOWN_MS) return;
  lastUnhandledAlertKey = key;
  lastUnhandledAlertAt = now;
  void reportOperationalAlert({
    source: "api-process",
    title: "Unhandled promise rejection",
    payload: {
      reason: reason instanceof Error ? { message, stack: reason.stack } : message,
    },
  });
});

process.on("uncaughtException", (error) => {
  logError("process.uncaught_exception", {
    message: error.message,
    stack: error.stack,
  });
  captureException(error);
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

// Cancel abandoned payment-sheet bookings so they stop blocking capacity.
// Defaults on (every 5 minutes); override with BOOKING_SWEEPER_INTERVAL_MS.
setInterval(() => {
  void sweepStalePendingBookings(25).catch((error) => {
    logWarn("booking-sweeper.tick_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
}, env.BOOKING_SWEEPER_INTERVAL_MS ?? 5 * 60 * 1000);

async function logRuntimeHealthChecks() {
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    logError("startup.database_check_failed", {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
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
      logError("startup.missing_user_columns", {
        missing,
      });
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
      logError("startup.schema_migrations_missing");
      return;
    }
    const appliedRes = await pool.query("SELECT filename FROM schema_migrations");
    const applied = new Set(appliedRes.rows.map((r: { filename: string }) => r.filename));
    const pending = allMigrations.filter((f) => !applied.has(f));
    if (pending.length) {
      logWarn("startup.pending_migrations", {
        count: pending.length,
        latest: pending[pending.length - 1],
      });
    }
  } catch (error) {
    logError("startup.runtime_schema_check_failed", {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
  }
}

export { app };
