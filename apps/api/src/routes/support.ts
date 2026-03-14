import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { sendMail } from "../lib/mailer.js";
import { createSupportTicket } from "../lib/db.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

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

router.post("/", requireAuth, supportLimiter, async (req, res, next) => {
  try {
    const payload = supportSchema.parse(req.body);
    const userEmail = req.user?.email ?? "unknown";
    const userId = req.user?.userId ?? "unknown";
    const to = process.env.SUPPORT_EMAIL ?? process.env.EMAIL_FROM ?? "support@freespace.local";
    const subject = `[FreeSpace Support] ${payload.subject}`;
    const text = `User: ${userEmail}\nUser ID: ${userId}\n\n${payload.message}`;

    const ticket = await createSupportTicket({
      userId: req.user?.userId ?? null,
      subject: payload.subject,
      message: payload.message,
    });

    await sendMail({ to, subject, text });
    res.json({ ok: true, ticketId: ticket?.id ?? null });
  } catch (err) {
    next(err);
  }
});

export default router;
