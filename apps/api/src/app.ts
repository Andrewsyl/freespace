import "./loadEnv.js";
import cors from "cors";
import express from "express";
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/node";
import { z } from "zod";
import authRouter from "./routes/auth.js";
import bookingsRouter from "./routes/bookings.js";
import listingsRouter from "./routes/listings.js";
import favoritesRouter from "./routes/favorites.js";
import reviewsRouter from "./routes/reviews.js";
import hostRouter from "./routes/host.js";
import adminRouter from "./routes/admin.js";
import paymentsRouter from "./routes/payments.js";
import supportRouter from "./routes/support.js";
import notificationsRouter from "./routes/notifications.js";
import { csrfProtection } from "./middleware/csrf.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    const requestId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : randomUUID();
    req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-Id", requestId);
    return next();
  });

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    return next();
  });

  const shouldEnforceHttps =
    process.env.ENFORCE_HTTPS === "true" ||
    (process.env.ENFORCE_HTTPS !== "false" && process.env.NODE_ENV === "production");

  if (shouldEnforceHttps) {
    app.use((req, res, next) => {
      if (req.secure || req.headers["x-forwarded-proto"] === "https") {
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

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const requestId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : "unknown";
    console.error("[api:error]", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    });
    Sentry.captureException(err, {
      tags: {
        requestId,
        method: req.method,
        path: req.originalUrl,
      },
    });

    if (err instanceof z.ZodError) {
      return res.status(422).json({
        message: "Validation failed",
        requestId,
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
          requestId,
          code: stripeCode,
          param: stripeParam,
          type: stripeType,
          stripeRequestId,
        });
      }
      return res.status(500).json({ message: "Internal server error", requestId });
    }

    res.status(500).json({ message: "An unexpected error occurred", requestId });
  });

  return app;
}
