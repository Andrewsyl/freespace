import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { enforceBlockedList } from "../middleware/fraud.js";
import { deletePushToken, upsertPushToken, getPushTokenStats, hasPushToken, insertEventLog } from "../lib/db.js";
import { processScheduledNotifications } from "../lib/notifications.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { getFraudSettings, shouldEnforceFraud } from "../middleware/fraud.js";

const router = Router();

const registerSchema = z.object({
  expoToken: z.string().trim().min(10),
  platform: z.enum(["ios", "android", "web"]).or(z.string().min(2)),
  deviceId: z.string().trim().optional(),
});

const processLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: "notifications-process",
});

const registerLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyPrefix: "notifications-register",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

router.post("/register", requireAuth, enforceBlockedList, registerLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const payload = registerSchema.parse(req.body);
    const settings = await getFraudSettings();
    const enforceFraud = shouldEnforceFraud(settings);
    const existing = await hasPushToken(userId, payload.expoToken);
    const stats = await getPushTokenStats(userId);
    if (!existing && stats.total_tokens >= settings.maxPushTokensPerUser) {
      await insertEventLog({
        eventType: "push_token_abuse",
        payload: { userId, reason: "token_limit", total: stats.total_tokens },
      });
      if (enforceFraud) {
        return res.status(429).json({ message: "Too many devices registered." });
      }
    }
    if (payload.deviceId && !existing && stats.total_devices >= settings.maxDevicesPerUser) {
      await insertEventLog({
        eventType: "push_token_abuse",
        payload: { userId, reason: "device_limit", total: stats.total_devices },
      });
      if (enforceFraud) {
        return res.status(429).json({ message: "Too many devices registered." });
      }
    }
    await upsertPushToken({
      userId,
      expoToken: payload.expoToken,
      platform: payload.platform,
      deviceId: payload.deviceId ?? null,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/register", requireAuth, enforceBlockedList, registerLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const payload = registerSchema.pick({ expoToken: true }).parse(req.body);
    const removed = await deletePushToken({ userId, expoToken: payload.expoToken });
    res.json({ ok: true, removed });
  } catch (error) {
    next(error);
  }
});

router.post("/process", processLimiter, async (req, res, next) => {
  try {
    const secret = process.env.NOTIFICATION_PROCESS_SECRET;
    const provided = req.headers["x-notification-secret"];
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({ message: "Notification processor not configured" });
      }
      return res.status(401).json({ message: "Notification secret missing" });
    }
    if (provided !== secret) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const sent = await processScheduledNotifications(50);
    res.json({ ok: true, sent });
  } catch (error) {
    next(error);
  }
});

export default router;
