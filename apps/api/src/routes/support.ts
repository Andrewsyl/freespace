import { Router } from "express";
import * as Sentry from "@sentry/node";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { sendMail } from "../lib/mailer.js";
import { getSupportEmailFrom, getSupportEmailInbox } from "../lib/emailSenders.js";
import { createSupportTicket, getLatestSupportTicketForUser, insertEventLog } from "../lib/db.js";
import { reportOperationalAlert } from "../lib/opsAlerts.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { enforceBlockedList } from "../middleware/fraud.js";
import { logError, logWarn } from "../lib/logger.js";

const router = Router();

const supportLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: "support",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

const supportSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
});

const clientErrorLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyPrefix: "client-error",
  keyGenerator: (req) => req.ip ?? "unknown",
});

const clientErrorSchema = z.object({
  source: z.enum(["mobile", "web"]),
  name: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(2000),
  stack: z.string().trim().max(12000).optional(),
  isFatal: z.boolean().optional(),
  appEnv: z.string().trim().min(1).max(40).optional(),
  runtimeUrl: z.string().trim().max(2000).optional(),
});

function isDeployTransitionClientError(payload: z.infer<typeof clientErrorSchema>) {
  const name = payload.name?.toLowerCase() ?? "";
  const message = payload.message.toLowerCase();
  const stack = payload.stack?.toLowerCase() ?? "";

  return (
    name.includes("chunkloaderror") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("css chunk") ||
    stack.includes("chunkloaderror")
  );
}

router.post("/", requireAuth, enforceBlockedList, supportLimiter, async (req, res, next) => {
  try {
    const payload = supportSchema.parse(req.body);
    const userEmail = req.user?.email ?? "unknown";
    const userId = req.user?.userId ?? "unknown";
    if (req.user?.userId) {
      const latest = await getLatestSupportTicketForUser(req.user.userId);
      if (latest) {
        const isDuplicate =
          latest.subject.trim().toLowerCase() === payload.subject.trim().toLowerCase() &&
          latest.message.trim().toLowerCase() === payload.message.trim().toLowerCase();
        if (isDuplicate) {
          await insertEventLog({
            eventType: "support_duplicate",
            payload: {
              userId: req.user.userId,
              latestTicketId: latest.id,
            },
          });
          return res.status(409).json({ message: "Duplicate support request." });
        }
      }
    }
    const to = getSupportEmailInbox();
    const subject = `[FreeSpace Support] ${payload.subject}`;
    const text = `User: ${userEmail}\nUser ID: ${userId}\n\n${payload.message}`;

    const ticket = await createSupportTicket({
      userId: req.user?.userId ?? null,
      subject: payload.subject,
      message: payload.message,
    });

    await sendMail({
      to,
      subject,
      text,
      from: getSupportEmailFrom(),
    });
    res.json({ ok: true, ticketId: ticket?.id ?? null });
  } catch (err) {
    next(err);
  }
});

router.post("/client-error", clientErrorLimiter, async (req, res, next) => {
  try {
    const payload = clientErrorSchema.parse(req.body);
    const normalizedEnv = payload.appEnv?.trim().toLowerCase();
    const runtimeUrl = payload.runtimeUrl?.trim().toLowerCase() ?? "";
    const isNonProdClientReport =
      normalizedEnv !== "production" ||
      runtimeUrl.includes("127.0.0.1") ||
      runtimeUrl.includes("localhost");
    const isDeployTransition = isDeployTransitionClientError(payload);
    logError("client.error_reported", {
      source: payload.source,
      name: payload.name ?? null,
      message: payload.message,
      isFatal: payload.isFatal ?? false,
      appEnv: payload.appEnv ?? null,
      suppressedEmail: isDeployTransition,
    });
    await insertEventLog({
      eventType: "client.error_reported",
      payload: {
        source: payload.source,
        name: payload.name ?? null,
        message: payload.message,
        isFatal: payload.isFatal ?? false,
        appEnv: payload.appEnv ?? null,
        suppressedEmail: isDeployTransition,
      },
    });
    if (isDeployTransition) {
      logWarn("client.error_suppressed", {
        source: payload.source,
        name: payload.name ?? null,
        message: payload.message,
      });
    }
    Sentry.captureException(new Error(`[${payload.source}] ${payload.message}`), {
      tags: {
        source: `${payload.source}-client`,
        isFatal: String(Boolean(payload.isFatal)),
        appEnv: payload.appEnv ?? "unknown",
      },
      extra: {
        name: payload.name ?? null,
        stack: payload.stack ?? null,
        runtimeUrl: payload.runtimeUrl ?? null,
      },
    });
    await reportOperationalAlert({
      source: `${payload.source}-client`,
      title: "Client error report",
      payload,
      sendEmail: !isNonProdClientReport && !isDeployTransition,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
