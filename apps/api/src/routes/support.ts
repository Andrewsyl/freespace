import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { sendMail } from "../lib/mailer.js";
import { createSupportTicket, getLatestSupportTicketForUser, insertEventLog } from "../lib/db.js";
import { reportOperationalAlert } from "../lib/opsAlerts.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { enforceBlockedList } from "../middleware/fraud.js";

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
});

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
    const to = process.env.SUPPORT_EMAIL ?? process.env.EMAIL_FROM ?? "support@freespace.local";
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
      from: process.env.EMAIL_FROM_SUPPORT ?? process.env.EMAIL_FROM,
    });
    res.json({ ok: true, ticketId: ticket?.id ?? null });
  } catch (err) {
    next(err);
  }
});

router.post("/client-error", clientErrorLimiter, async (req, res, next) => {
  try {
    const payload = clientErrorSchema.parse(req.body);
    await reportOperationalAlert({
      source: `${payload.source}-client`,
      title: "Client error report",
      payload,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
