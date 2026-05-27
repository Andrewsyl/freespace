import { Router } from "express";
import { z } from "zod";
import { insertEventLog } from "../lib/db.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();

const analyticsLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 250,
  keyPrefix: "analytics",
  keyGenerator: (req) => req.ip ?? "unknown",
});

const analyticsSchema = z.object({
  eventType: z.string().trim().min(3).max(64),
  source: z.enum(["web", "mobile"]).default("web"),
  sessionId: z.string().trim().min(6).max(128).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

router.post("/track", analyticsLimiter, async (req, res, next) => {
  try {
    const payload = analyticsSchema.parse(req.body);
    const requestId =
      typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : "unknown";
    await insertEventLog({
      eventType: payload.eventType,
      payload: {
        source: payload.source,
        sessionId: payload.sessionId ?? null,
        properties: payload.properties ?? {},
        requestId,
        path: req.originalUrl,
        userAgent: req.get("user-agent") ?? null,
        referer: req.get("referer") ?? null,
        ip: req.ip ?? null,
      },
    });
    res.json({ ok: true, requestId });
  } catch (error) {
    next(error);
  }
});

export default router;
