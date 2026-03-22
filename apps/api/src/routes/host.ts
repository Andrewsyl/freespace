import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { enforceBlockedList, getFraudSettings, getUserRiskProfile, shouldEnforceFraud } from "../middleware/fraud.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import {
  findUserById,
  setHostStripeAccountId,
  getListingHostId,
  listAvailability,
  createAvailabilityEntry,
  deleteAvailabilityEntry,
  updateAvailabilityEntry,
  getHostEarningsSummary,
  listDuePayoutsForHost,
  markPayoutProcessing,
  markPayoutTransferred,
  markPayoutPending,
} from "../lib/db.js";
import { stripe } from "../lib/stripe.js";

const router = Router();
const connectEnabled = process.env.STRIPE_CONNECT_ENABLED === "true";

const payoutLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyPrefix: "host-payout",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});
const hostReadLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 60,
  keyPrefix: "host-read",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});
const hostAvailabilityWriteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyPrefix: "host-availability-write",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

async function requireActiveHost(userId?: string) {
  if (!userId) return { ok: false, message: "Unauthorized" } as const;
  const settings = await getFraudSettings();
  const enforceFraud = shouldEnforceFraud(settings);
  const profile = await getUserRiskProfile(userId);
  if (!profile) return { ok: false, message: "Unauthorized" } as const;
  if (profile.status === "suspended") {
    return { ok: false, message: "Account suspended. Contact support." } as const;
  }
  if (!profile.email_verified) {
    return { ok: false, message: "Please verify your email before hosting." } as const;
  }
  const accountAgeMinutes = (Date.now() - new Date(profile.created_at).getTime()) / 60000;
  if (accountAgeMinutes < settings.minAccountAgeMinutes) {
    if (!enforceFraud) {
      console.warn("[fraud] host account age below threshold", {
        userId,
        accountAgeMinutes,
        minAccountAgeMinutes: settings.minAccountAgeMinutes,
      });
      return { ok: true } as const;
    }
    return { ok: false, message: "Please wait a few minutes before hosting." } as const;
  }
  return { ok: true } as const;
}

function isStripeConnectDisabled(error: unknown) {
  const maybe = error as {
    type?: string;
    raw?: { message?: string };
    message?: string;
  };
  const text = maybe.raw?.message ?? maybe.message ?? "";
  return (
    maybe.type === "StripeInvalidRequestError" &&
    text.includes("signed up for Connect")
  );
}

router.get("/payout", requireAuth, enforceBlockedList, payoutLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveHost(userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const user = await findUserById(userId);
    const accountId = user?.host_stripe_account_id ?? null;
    if (!connectEnabled || !stripe || !accountId || accountId.startsWith("acct_mock_")) {
      return res.json({
        accountId,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requirementsDue: [],
      });
    }
    try {
      const account = await stripe.accounts.retrieve(accountId);
      res.json({
        accountId,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        requirementsDue: account.requirements?.currently_due ?? [],
      });
    } catch (error) {
      if (isStripeConnectDisabled(error)) {
        return res.json({
          accountId: `acct_mock_${userId.slice(0, 8)}`,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          requirementsDue: [],
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

const payoutSchema = z.object({
  accountId: z.string().trim().max(128).optional(),
  returnUrl: z.string().trim().url().optional(),
  refreshUrl: z.string().trim().url().optional(),
});

router.post("/payout", requireAuth, enforceBlockedList, payoutLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveHost(userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });

    const payload = payoutSchema.parse(req.body ?? {});
    let accountId = payload.accountId;

    if (!accountId) {
      if (connectEnabled && stripe) {
        try {
          const account = await stripe.accounts.create({
            type: "express",
            capabilities: {
              card_payments: { requested: true },
              transfers: { requested: true },
            },
            settings: {
              payouts: {
                schedule: { interval: "daily" },
              },
            },
          });
          accountId = account.id;
        } catch (error) {
          if (isStripeConnectDisabled(error)) {
            accountId = `acct_mock_${userId.slice(0, 8)}`;
          } else {
            throw error;
          }
        }
      } else {
        accountId = `acct_mock_${userId.slice(0, 8)}`;
      }
    }

    await setHostStripeAccountId(userId, accountId);
    let onboardingUrl: string | null = null;
    if (connectEnabled && stripe && !accountId.startsWith("acct_mock_")) {
      const baseUrl = process.env.WEB_BASE_URL ?? "http://localhost:3000";
      const refreshUrl = payload.refreshUrl ?? `${baseUrl}/host/payouts`;
      const returnUrl = payload.returnUrl ?? `${baseUrl}/host/payouts`;
      try {
        const link = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: "account_onboarding",
        });
        onboardingUrl = link.url;
      } catch (error) {
        if (!isStripeConnectDisabled(error)) {
          throw error;
        }
      }
    }

    res.json({ accountId, onboardingUrl, mock: accountId.startsWith("acct_mock_") });
  } catch (error) {
    next(error);
  }
});

router.get("/earnings", requireAuth, enforceBlockedList, hostReadLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveHost(userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const summary = await getHostEarningsSummary(userId);
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

router.post("/payouts/run", requireAuth, enforceBlockedList, payoutLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveHost(userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const user = await findUserById(userId);
    const accountId = user?.host_stripe_account_id ?? null;
    if (!connectEnabled || !stripe || !accountId || accountId.startsWith("acct_mock_")) {
      return res.json({ processed: 0, skipped: true });
    }

    const due = await listDuePayoutsForHost(userId);
    let processed = 0;
    for (const booking of due) {
      const locked = await markPayoutProcessing(booking.id);
      if (!locked) continue;
      const net = Math.max(0, Number(booking.amount_cents) - Number(booking.fee_cents));
      if (net <= 0) {
        await markPayoutPending(booking.id);
        continue;
      }
      try {
        const transfer = await stripe.transfers.create({
          amount: net,
          currency: (booking.currency ?? "eur").toLowerCase(),
          destination: accountId,
          metadata: { booking_id: booking.id },
        });
        await markPayoutTransferred({ bookingId: booking.id, transferId: transfer.id });
        processed += 1;
      } catch {
        await markPayoutPending(booking.id);
      }
    }
    res.json({ processed });
  } catch (error) {
    next(error);
  }
});

const availabilityShape = z.object({
  kind: z.enum(["open", "blocked"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  repeatWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  repeatUntil: z.string().datetime().optional().nullable(),
});

const availabilitySchema = availabilityShape
  .superRefine((value, ctx) => {
    const start = Date.parse(value.startsAt);
    const end = Date.parse(value.endsAt);
    if (Number.isNaN(start) || Number.isNaN(end)) return;
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End time must be after start time",
      });
    }
  });

const partialAvailabilitySchema = availabilityShape.partial();

const listingIdParamSchema = z.object({
  id: z.string().uuid(),
});

const availabilityIdParamSchema = z.object({
  availabilityId: z.string().uuid(),
});

router.get("/listings/:id/availability", requireAuth, enforceBlockedList, hostReadLimiter, async (req, res, next) => {
  try {
    const { id: listingId } = listingIdParamSchema.parse(req.params);
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveHost(hostId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const ownerId = await getListingHostId(listingId);
    if (ownerId !== hostId) return res.status(403).json({ message: "Forbidden" });
    const availability = await listAvailability(listingId);
    res.json({ availability });
  } catch (error) {
    next(error);
  }
});

router.post("/listings/:id/availability", requireAuth, enforceBlockedList, hostAvailabilityWriteLimiter, async (req, res, next) => {
  try {
    const { id: listingId } = listingIdParamSchema.parse(req.params);
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveHost(hostId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const ownerId = await getListingHostId(listingId);
    if (ownerId !== hostId) return res.status(403).json({ message: "Forbidden" });
    const payload = availabilitySchema.parse(req.body);
    const created = await createAvailabilityEntry({
      listingId,
      kind: payload.kind,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      repeatWeekdays: payload.repeatWeekdays,
      repeatUntil: payload.repeatUntil ?? null,
    });
    res.status(201).json({ availability: created });
  } catch (error) {
    next(error);
  }
});

router.patch("/availability/:availabilityId", requireAuth, enforceBlockedList, hostAvailabilityWriteLimiter, async (req, res, next) => {
  try {
    const { availabilityId } = availabilityIdParamSchema.parse(req.params);
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveHost(hostId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const payload = partialAvailabilitySchema.parse(req.body);
    const updated = await updateAvailabilityEntry({
      id: availabilityId,
      hostId,
      kind: payload.kind,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      repeatWeekdays: payload.repeatWeekdays,
      repeatUntil: payload.repeatUntil ?? null,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json({ availability: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/availability/:availabilityId", requireAuth, enforceBlockedList, hostAvailabilityWriteLimiter, async (req, res, next) => {
  try {
    const { availabilityId } = availabilityIdParamSchema.parse(req.params);
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveHost(hostId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const deleted = await deleteAvailabilityEntry({ id: availabilityId, hostId });
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
