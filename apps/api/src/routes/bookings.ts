import express, { Router } from "express";
import { z } from "zod";
import {
  createBooking,
  pool,
  updateBookingStatus,
  updateBookingStatusByPaymentIntent,
  insertEventLog,
  markBookingRefundedByPaymentIntent,
  listUserBookings,
  getBookingById,
  getListingWithHostAccount,
  findUserById,
  cancelBookingByDriver,
  cancelBookingWithRefund,
  getBookingForRefund,
  getBookingForHostRefund,
  getBookingForExtension,
  getBookingNotificationTargets,
  getBookingNotificationTargetsByCheckoutSession,
  getBookingNotificationTargetsByPaymentIntent,
  deleteScheduledNotificationsByBooking,
  insertScheduledNotification,
  listPushTokensByUserIds,
  updateBookingExtension,
  checkInBooking,
  updateBookingWindow,
  findUserByEmail,
  createUser,
  getBookingByPaymentIntent,
  cancelBookingWithRefundByHost,
  listDuePayoutsForHost,
  markPayoutProcessing,
  markPayoutTransferred,
  markPayoutPending,
  validatePromoForBooking,
  insertBookingPayment,
  listUnrefundedBookingPayments,
  markBookingPaymentRefunded,
} from "../lib/db.js";
import { createCheckoutSession, getOrCreateStripeCustomer, stripe } from "../lib/stripe.js";
import { sendBookingEmail, sendBookingStatusEmail } from "../lib/email.js";
import { sendPushNotification } from "../lib/notifications.js";
import { reportOperationalAlert } from "../lib/opsAlerts.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import {
  enforceBlockedList,
  getFraudSettings,
  getRecentBookingStats,
  getUserRiskProfile,
  shouldEnforceFraud,
} from "../middleware/fraud.js";
import "../loadEnv.js";
import { generateVerificationToken, hashPassword } from "../lib/auth.js";
import { env } from "../env.js";

const router = Router();
const DEFAULT_DAILY_HOURS = 8;
// The platform's cut is a server-owned constant, never taken from the client.
// A caller could otherwise send platformFeePercent: 0 and keep the driver's
// price identical while silently zeroing the fee (host payout = charge - fee).
const PLATFORM_FEE_PERCENT = 8 / 108;

// A booking INSERT can fail because the slot filled up between our pre-check and
// the write. Two Postgres error codes signal this:
//   - 23P01: the legacy `bookings_no_overlap` exclusion constraint (pre-migration
//     036; kept here so older databases still map cleanly).
//   - P0001: the `check_booking_capacity` trigger's `listing_at_capacity` RAISE,
//     which is the live path once migration 036 dropped the exclusion constraint.
// Both mean "someone else took the last space" and should surface as a clean 409
// rather than a generic 500 + false "persistence failed" alert.
function isSlotConflictError(error: any): boolean {
  return error?.code === "23P01" || error?.code === "P0001";
}


function calculateListingChargeCents(input: {
  rateType?: string | null;
  pricePerDay: number;
  pricePerHour?: number | null;
  startTime: Date;
  endTime: Date;
}) {
  const durationHours = Math.max(
    1,
    Math.ceil((input.endTime.getTime() - input.startTime.getTime()) / (1000 * 60 * 60))
  );

  const explicitDaily =
    Number.isFinite(Number(input.pricePerDay)) && Number(input.pricePerDay) > 0
      ? Number(input.pricePerDay)
      : null;
  const derivedHourly =
    input.pricePerHour != null && Number(input.pricePerHour) > 0
      ? Number(input.pricePerHour)
      : explicitDaily != null
        ? explicitDaily / DEFAULT_DAILY_HOURS
        : 0;

  if (explicitDaily != null && derivedHourly > 0) {
    const fullDays = Math.floor(durationHours / 24);
    const remainingHours = durationHours % 24;
    const remainingCents =
      remainingHours > 0
        ? Math.round(Math.min(derivedHourly * remainingHours, explicitDaily) * 100)
        : 0;
    return Math.max(1, Math.round(explicitDaily * fullDays * 100) + remainingCents);
  }

  if (derivedHourly > 0) {
    return Math.max(1, Math.round(derivedHourly * durationHours * 100));
  }

  return 0;
}

// Number of whole months covered by a booking window. Calendar months vary
// (28–31 days), so we round against the average month length — a 1-month
// window resolves to 1, two months to 2, etc.
const AVG_MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;
function monthsBetween(startTime: Date, endTime: Date) {
  return Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / AVG_MONTH_MS));
}

function calculateMonthlyChargeCents(input: {
  pricePerMonth?: number | null;
  startTime: Date;
  endTime: Date;
}) {
  const monthly = Number(input.pricePerMonth);
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;
  const months = monthsBetween(input.startTime, input.endTime);
  return Math.max(1, Math.round(monthly * months * 100));
}
const bookingLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyPrefix: "booking",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});
const portalBookingLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyPrefix: "portal-booking",
  // Keyed on IP+listing, not just IP: this is an unauthenticated route that
  // creates a pending booking (which counts against listing capacity) before
  // any payment completes. An IP-only key still lets one attacker camp a
  // single low-capacity listing at the full budget and lock out real
  // walk-up customers scanning that listing's QR code.
  keyGenerator: (req) => `${req.ip ?? "unknown"}:${(req.body as { listingId?: string })?.listingId ?? "unknown"}`,
});
const bookingReadLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 60,
  keyPrefix: "booking-read",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

function buildBookingIntentKey(input: {
  driverId: string;
  listingId: string;
  from: string;
  to: string;
  amountCents: number;
  currency: string;
  source: string;
}) {
  return [
    input.source,
    input.driverId,
    input.listingId,
    input.from,
    input.to,
    input.amountCents,
    input.currency.toLowerCase(),
  ].join(":");
}

async function createRefundSafely({
  paymentIntentId,
  bookingId,
  reason,
}: {
  paymentIntentId: string;
  bookingId: string;
  reason: string;
}) {
  if (!stripe) throw new Error("Stripe not configured");
  try {
    return await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        metadata: {
          booking_id: bookingId,
          reason,
        },
      },
      {
        idempotencyKey: `refund:${reason}:${bookingId}:${paymentIntentId}`,
      }
    );
  } catch (err: any) {
    if (err?.code === "charge_already_refunded") {
      return null;
    }
    throw err;
  }
}

async function refundBookingPayment({
  paymentIntentId,
  bookingId,
  existingRefundId,
  existingRefundStatus,
  reason,
}: {
  paymentIntentId: string | null;
  bookingId: string;
  existingRefundId?: string | null;
  existingRefundStatus?: string | null;
  reason: string;
}) {
  if (!paymentIntentId || !stripe) {
    return { refundId: existingRefundId ?? null, alreadyRefunded: Boolean(existingRefundId) };
  }
  if (existingRefundStatus === "succeeded" || existingRefundId) {
    return { refundId: existingRefundId ?? null, alreadyRefunded: true };
  }

  const refund = await createRefundSafely({ paymentIntentId, bookingId, reason });
  if (!refund) {
    return { refundId: null, alreadyRefunded: true };
  }

  await markBookingRefundedByPaymentIntent({
    paymentIntentId,
    refundId: refund.id,
  });
  return { refundId: refund.id, alreadyRefunded: false };
}

// Refunds every recorded extension/change top-up for a booking that hasn't
// been refunded yet. Refunds are idempotent (keyed on booking+intent), so
// re-running after a partial failure is safe.
async function refundBookingTopUpPayments({
  bookingId,
  reason,
}: {
  bookingId: string;
  reason: string;
}) {
  if (!stripe) return;
  const topUps = await listUnrefundedBookingPayments(bookingId);
  for (const payment of topUps) {
    const refund = await createRefundSafely({
      paymentIntentId: payment.payment_intent_id,
      bookingId,
      reason,
    });
    await markBookingPaymentRefunded({
      paymentIntentId: payment.payment_intent_id,
      refundId: refund?.id ?? null,
    });
  }
}

async function refundOrphanPayment({
  paymentIntentId,
  referenceId,
  source,
}: {
  paymentIntentId: string;
  referenceId: string;
  source: string;
}) {
  const refund = await createRefundSafely({
    paymentIntentId,
    bookingId: `orphan:${referenceId}`,
    reason: source,
  });
  await insertEventLog({
    eventType: refund ? "orphan_payment_refunded" : "orphan_payment_already_refunded",
    payload: {
      source,
      referenceId,
      paymentIntentId,
      refundId: refund?.id ?? null,
    },
  });
  await reportOperationalAlert({
    source: "stripe-webhook",
    title: "Stripe payment received without booking record",
    payload: {
      source,
      referenceId,
      paymentIntentId,
      refundId: refund?.id ?? null,
    },
  });
}

// Handles payment_intent.succeeded for extension/change top-ups. These
// intents never appear in bookings.payment_intent_id, so without this they'd
// hit the orphan path and get auto-refunded. Records the charge and — when the
// client's confirm call never arrives (app killed after paying) — applies the
// new window from the server-set intent metadata, or refunds on conflict.
async function handleTopUpPaymentSucceeded(intent: any) {
  const paymentIntentId = intent.id as string;
  const kind: "extension" | "change" = intent.metadata?.type === "change" ? "change" : "extension";
  const bookingId = intent.metadata?.booking_id?.trim() ?? "";
  const driverId = intent.metadata?.driver_id?.trim() ?? "";

  if (!bookingId || !driverId) {
    await refundOrphanPayment({
      paymentIntentId,
      referenceId: paymentIntentId,
      source: `payment_intent.succeeded:${kind}`,
    });
    return;
  }
  const booking = await getBookingForExtension({ bookingId, driverId });
  if (!booking) {
    await refundOrphanPayment({
      paymentIntentId,
      referenceId: bookingId,
      source: `payment_intent.succeeded:${kind}`,
    });
    return;
  }

  // Record the charge (idempotent on payment_intent_id). If it already
  // exists, the client's confirm call has handled everything.
  const isNew = await insertBookingPayment({
    bookingId,
    paymentIntentId,
    amountCents: Number(intent.amount) || 0,
    currency: intent.currency ?? "eur",
    kind,
  });
  if (!isNew) return;

  const refundTopUp = async (reason: string) => {
    const refund = await createRefundSafely({ paymentIntentId, bookingId, reason });
    await markBookingPaymentRefunded({ paymentIntentId, refundId: refund?.id ?? null });
    await insertEventLog({
      eventType: "booking_topup_refunded",
      payload: { bookingId, paymentIntentId, kind, reason },
    });
  };

  if (booking.status !== "confirmed") {
    // Booking was canceled while the user was paying — money back.
    await refundTopUp("booking_not_confirmed");
    return;
  }

  const newEndRaw = intent.metadata?.new_end_time?.trim() ?? "";
  const newStartRaw = intent.metadata?.new_start_time?.trim() ?? "";
  const newTotalCents = Number(intent.metadata?.new_total_cents ?? 0);
  const newEnd = newEndRaw ? new Date(newEndRaw) : null;
  if (!newEnd || Number.isNaN(newEnd.getTime()) || newTotalCents <= 0) {
    // Intent created before window metadata existed: the client confirm
    // applies the change; the charge is recorded so refunds still cover it.
    return;
  }
  const newStart =
    kind === "change" && newStartRaw && !Number.isNaN(new Date(newStartRaw).getTime())
      ? new Date(newStartRaw)
      : new Date(booking.start_time);

  const alreadyApplied =
    new Date(booking.start_time).getTime() === newStart.getTime() &&
    new Date(booking.end_time).getTime() === newEnd.getTime();
  if (alreadyApplied) return;

  const overlapCheck = await pool.query(
    `SELECT 1 FROM bookings
     WHERE listing_id = $1
       AND id <> $2
       AND (status IS NULL OR status <> 'canceled')
       AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
     LIMIT 1`,
    [booking.listing_id, booking.id, newStart.toISOString(), newEnd.toISOString()]
  );
  if (overlapCheck.rowCount && overlapCheck.rowCount > 0) {
    await refundTopUp("booking_conflict");
    return;
  }

  try {
    const receiptUrl = (intent as any).charges?.data?.[0]?.receipt_url ?? null;
    const updated =
      kind === "change"
        ? await updateBookingWindow({
            bookingId,
            driverId,
            newStartTime: newStart.toISOString(),
            newEndTime: newEnd.toISOString(),
            newAmountCents: newTotalCents,
            receiptUrl,
          })
        : await updateBookingExtension({
            bookingId,
            driverId,
            newEndTime: newEnd.toISOString(),
            newAmountCents: newTotalCents,
            receiptUrl,
          });
    if (!updated) {
      await refundTopUp("booking_update_failed");
      return;
    }
  } catch (error) {
    if (isSlotConflictError(error)) {
      await refundTopUp("booking_conflict");
      return;
    }
    throw error;
  }
  await insertEventLog({
    eventType: "booking_topup_applied_by_webhook",
    payload: { bookingId, paymentIntentId, kind },
  });
}

async function requireActiveDriver(userId?: string) {
  if (!userId) return { ok: false, message: "Unauthorized" } as const;
  const settings = await getFraudSettings();
  const enforceFraud = shouldEnforceFraud(settings);
  const profile = await getUserRiskProfile(userId);
  if (!profile) return { ok: false, message: "Unauthorized" } as const;
  if (profile.status === "suspended") {
    return { ok: false, message: "Account suspended. Contact support." } as const;
  }
  if (!profile.email_verified) {
    return { ok: false, message: "Please verify your email before booking." } as const;
  }
  const accountAgeMinutes = (Date.now() - new Date(profile.created_at).getTime()) / 60000;
  if (accountAgeMinutes < settings.minAccountAgeMinutes) {
    if (!enforceFraud) {
      console.warn("[fraud] driver account age below threshold", {
        userId,
        accountAgeMinutes,
        minAccountAgeMinutes: settings.minAccountAgeMinutes,
      });
      return { ok: true } as const;
    }
    return { ok: false, message: "Please wait a few minutes before booking." } as const;
  }
  return { ok: true } as const;
}

const bookingSchemaBase = z.object({
  listingId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  mode: z.enum(["daily", "monthly"]).optional(),
  amountCents: z.number().int().positive().max(10000000),
  currency: z.string().trim().length(3).transform((value) => value.toLowerCase()).default("eur"),
  platformFeePercent: z.number().min(0).max(0.3).default(8 / 108),
  vehiclePlate: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Za-z0-9 \-]+$/, "Only letters, numbers, spaces, and dashes")
    .optional()
    .nullable(),
});

const bookingSchema = bookingSchemaBase.superRefine((value, ctx) => {
  const start = Date.parse(value.from);
  const end = Date.parse(value.to);
  if (Number.isNaN(start) || Number.isNaN(end)) return;
  if (end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["to"],
      message: "End time must be after start time",
    });
  }
});

const paymentIntentSchema = bookingSchemaBase
  .pick({
    listingId: true,
    from: true,
    to: true,
    amountCents: true,
    currency: true,
    platformFeePercent: true,
    vehiclePlate: true,
  })
  .extend({
    promoCode: z.string().trim().min(1).max(40).optional(),
  });

const promoValidateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  listingId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const portalBookingSchema = z.object({
  listingId: z.string().uuid(),
  until: z.string().datetime(),
  vehiclePlate: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Za-z0-9 \-]+$/, "Only letters, numbers, spaces, and dashes"),
});

function formatBookingWindow(start: Date, end: Date) {
  const startText = start.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });
  const endText = end.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });
  return `${startText} → ${endText}`;
}

async function sendDriverBookingLifecycleEmail(input: {
  driverEmail?: string | null;
  status: "confirmed" | "canceled";
  bookingId: string;
  listingTitle: string;
  listingAddress: string;
  startTime: Date;
  endTime: Date;
  receiptUrl?: string | null;
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  amountCents?: number | null;
  vehiclePlate?: string | null;
}) {
  if (!input.driverEmail) return;
  const windowText = formatBookingWindow(input.startTime, input.endTime);
  try {
    await sendBookingStatusEmail({
      to: input.driverEmail,
      status: input.status,
      bookingId: input.bookingId,
      listingTitle: input.listingTitle,
      listingAddress: input.listingAddress,
      windowText,
      startTime: input.startTime,
      endTime: input.endTime,
      accessCode: input.accessCode,
      arrivalInstructions: input.arrivalInstructions,
      receiptUrl: input.receiptUrl,
      amountCents: input.amountCents,
      vehiclePlate: input.vehiclePlate,
    });
  } catch (error) {
    await insertEventLog({
      eventType: "booking_email_failed",
      payload: {
        bookingId: input.bookingId,
        status: input.status,
        email: input.driverEmail,
        message: error instanceof Error ? error.message : "Unknown email error",
      },
    });
  }
}

async function hasBookingOverlap({
  listingId,
  bookingId,
  startTime,
  endTime,
}: {
  listingId: string;
  bookingId: string;
  startTime: Date;
  endTime: Date;
}) {
  const overlap = await pool.query(
    `
    SELECT
      (SELECT COUNT(*) FROM bookings
       WHERE listing_id = $1
         AND id <> $2
         AND (status IS NULL OR status <> 'canceled')
         AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
      ) AS booked_count,
      COALESCE(capacity, 1) AS capacity
    FROM listings WHERE id = $1 LIMIT 1
    `,
    [listingId, bookingId, startTime, endTime]
  );
  const row = overlap.rows[0];
  if (!row) return false;
  return Number(row.booked_count) >= Number(row.capacity);
}

async function sendBookingStatusPush({
  bookingId,
  driverId,
  hostId,
  listingTitle,
  startTime,
  endTime,
  status,
}: {
  bookingId: string;
  driverId: string;
  hostId: string;
  listingTitle: string;
  startTime: Date;
  endTime: Date;
  status: "confirmed" | "canceled";
}) {
  const tokens = await listPushTokensByUserIds([driverId, hostId]);
  if (!tokens.length) return;

  const byUser = new Map<string, string[]>();
  for (const token of tokens) {
    const list = byUser.get(token.user_id) ?? [];
    list.push(token.expo_token);
    byUser.set(token.user_id, list);
  }

  const windowText = formatBookingWindow(startTime, endTime);
  const driverTokens = byUser.get(driverId) ?? [];
  const hostTokens = byUser.get(hostId) ?? [];
  const now = Date.now();
  const historyTab =
    status === "confirmed" && startTime.getTime() <= now && now < endTime.getTime()
      ? "active"
      : "upcoming";

  if (driverTokens.length) {
    await sendPushNotification({
      tokens: driverTokens,
      title: status === "confirmed" ? "Booking confirmed" : "Booking canceled",
      body: `${listingTitle} · ${windowText}`,
      data: {
        bookingId,
        status,
        role: "driver",
        type: status === "confirmed" ? "booking_confirmed" : "booking_canceled",
        historyTab,
      },
    });
  }

  if (hostTokens.length) {
    await sendPushNotification({
      tokens: hostTokens,
      title: status === "confirmed" ? "New booking confirmed" : "Booking canceled",
      body: `${listingTitle} · ${windowText}`,
      data: {
        bookingId,
        status,
        role: "host",
        type: status === "confirmed" ? "booking_confirmed" : "booking_canceled",
        historyTab,
      },
    });
  }
}

async function scheduleBookingNotifications({
  bookingId,
  driverId,
  startTime,
  endTime,
}: {
  bookingId: string;
  driverId: string;
  startTime: Date;
  endTime: Date;
}) {
  const now = Date.now();
  const startSoon = new Date(startTime.getTime() - 60 * 60 * 1000);
  // Only send the "starts in 1 hour" reminder when the booking is genuinely
  // more than an hour away. For imminent bookings the "1 hour" copy would be
  // wrong and the reminder is pointless (the user just booked it), so skip it —
  // the "Booking confirmed" notification already covers the immediate case.
  if (startSoon.getTime() > now + 60 * 1000) {
    await insertScheduledNotification({
      userId: driverId,
      bookingId,
      type: "booking_start_soon",
      scheduledAt: startSoon,
    });
  }

  const endSoon = new Date(endTime.getTime() - 30 * 60 * 1000);
  if (endSoon.getTime() > now + 5 * 60 * 1000) {
    await insertScheduledNotification({
      userId: driverId,
      bookingId,
      type: "booking_end_soon",
      scheduledAt: endSoon,
    });
  }

  const reviewTime = new Date(endTime.getTime() + 60 * 60 * 1000);
  await insertScheduledNotification({
    userId: driverId,
    bookingId,
    type: "review_reminder",
    scheduledAt: reviewTime,
  });
}

async function getOrCreateCustomer(user: { id: string; email: string; stripe_customer_id?: string | null }) {
  if (!stripe) throw new Error("Stripe not configured");
  return getOrCreateStripeCustomer(stripe, user);
}

async function getOrCreatePortalGuestUserId() {
  const portalEmail = process.env.PORTAL_GUEST_EMAIL ?? "qr-portal@freespace.local";
  const existing = await findUserByEmail(portalEmail);
  if (existing) return existing.id;
  const passwordHash = await hashPassword(generateVerificationToken());
  const created = await createUser({
    email: portalEmail,
    passwordHash,
    verificationToken: null,
    verificationExpires: null,
  });
  if (!created) throw new Error("Could not provision portal guest user");
  return created.id;
}

router.post("/", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    const payload = bookingSchema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const settings = await getFraudSettings();
    const enforceFraud = shouldEnforceFraud(settings);
    const profile = await getUserRiskProfile(driverId);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    if (profile.status === "suspended") {
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }
    if (!profile.email_verified) {
      return res.status(403).json({ message: "Please verify your email before booking." });
    }
    const accountAgeMinutes = (Date.now() - new Date(profile.created_at).getTime()) / 60000;
    if (accountAgeMinutes < settings.minAccountAgeMinutes) {
      if (enforceFraud) {
        return res.status(429).json({ message: "Please wait a few minutes before booking." });
      }
      console.warn("[fraud] booking account age below threshold", {
        userId: driverId,
        accountAgeMinutes,
        minAccountAgeMinutes: settings.minAccountAgeMinutes,
      });
    }
    const recent = await getRecentBookingStats(driverId);
    if (recent.count >= settings.maxBookingsPerDay) {
      if (enforceFraud) {
        return res.status(429).json({ message: "Booking limit reached. Try again later." });
      }
      console.warn("[fraud] booking count above threshold", {
        userId: driverId,
        count: recent.count,
        maxBookingsPerDay: settings.maxBookingsPerDay,
      });
    }
    const listingWithHost = await getListingWithHostAccount(payload.listingId);
    if (!listingWithHost) {
      return res.status(404).json({ message: "Listing not found" });
    }
    if (listingWithHost.hostId === driverId) {
      return res.status(403).json({ message: "You cannot book your own listing." });
    }
    // Price is always recomputed server-side from the listing — the client's
    // amount is only accepted if it matches. Monthly uses the host's monthly
    // rate; everything else uses the hourly/daily rate.
    const isMonthlyBooking = payload.mode === "monthly";
    if (isMonthlyBooking && !(Number(listingWithHost.pricePerMonth) > 0)) {
      return res.status(400).json({ message: "This space isn't available for monthly booking." });
    }
    const expectedParkingCents = isMonthlyBooking
      ? calculateMonthlyChargeCents({
          pricePerMonth: listingWithHost.pricePerMonth,
          startTime: new Date(payload.from),
          endTime: new Date(payload.to),
        })
      : calculateListingChargeCents({
          rateType: listingWithHost.rateType,
          pricePerDay: listingWithHost.pricePerDay,
          pricePerHour: listingWithHost.pricePerHour,
          startTime: new Date(payload.from),
          endTime: new Date(payload.to),
        });
    const expectedAmountCents = Math.round(expectedParkingCents * 1.08);
    if (payload.amountCents !== expectedAmountCents) {
      return res.status(400).json({ message: "Booking price is out of date. Please refresh and try again." });
    }

    if (recent.total_cents + expectedAmountCents > settings.maxAmountPerDayCents) {
      if (enforceFraud) {
        return res.status(429).json({ message: "Daily booking limit reached." });
      }
      console.warn("[fraud] booking spend above threshold", {
        userId: driverId,
        totalCents: recent.total_cents,
        attemptedCents: expectedAmountCents,
        maxAmountPerDayCents: settings.maxAmountPerDayCents,
      });
    }

    const capacityCheck = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM bookings
          WHERE listing_id = $1
            AND (status IS NULL OR status <> 'canceled')
            AND tstzrange(start_time, end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
         ) AS booked_count,
         COALESCE(capacity, 1) AS capacity
       FROM listings WHERE id = $1 LIMIT 1`,
      [payload.listingId, payload.from, payload.to]
    );

    const capacityRow = capacityCheck.rows[0];
    if (capacityRow && Number(capacityRow.booked_count) >= Number(capacityRow.capacity)) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const driver = await findUserById(driverId);
    const payoutAvailableAt = new Date(
      new Date(payload.from).getTime() + 24 * 60 * 60 * 1000
    );

    const platformFeeCents = Math.round(expectedAmountCents * PLATFORM_FEE_PERCENT);
    const session = await createCheckoutSession({
      amount: expectedAmountCents,
      currency: payload.currency,
      listingId: payload.listingId,
      hostStripeAccountId: listingWithHost?.hostStripeAccountId ?? null,
      platformFeePercent: PLATFORM_FEE_PERCENT,
      successUrl: `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      // Dismissing Stripe Checkout isn't an error — send the user straight back
      // to the booking page instead of an alarming "cancelled" screen.
      cancelUrl: `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/checkout/${payload.listingId}`,
      driverId,
      userEmail: driver?.email ?? null,
      manualReview: settings.manualReview,
      source: "booking",
      idempotencyKey: buildBookingIntentKey({
        source: "checkout",
        driverId,
        listingId: payload.listingId,
        from: payload.from,
        to: payload.to,
        amountCents: expectedAmountCents,
        currency: payload.currency,
      }),
    });

    // Persist reservation as pending; confirm via Stripe webhook in production.
    try {
      await createBooking({
        listingId: payload.listingId,
        driverId,
        from: payload.from,
        to: payload.to,
        stripePaymentIntentId: session.payment_intent as string,
        checkoutSessionId: session.id,
        amountCents: expectedAmountCents,
        currency: payload.currency,
        platformFeeCents,
        payoutAvailableAt,
        vehiclePlate: payload.vehiclePlate ? payload.vehiclePlate.toUpperCase() : null,
      });
    } catch (error) {
      if (stripe && session.id) {
        try {
          await stripe.checkout.sessions.expire(session.id);
        } catch (expireError) {
          console.warn("Failed to expire checkout session after booking persistence failure", expireError);
        }
      }
      await reportOperationalAlert({
        source: "booking-create",
        title: "Checkout session created but booking persistence failed",
        payload: {
          driverId,
          listingId: payload.listingId,
          checkoutSessionId: session.id,
          paymentIntentId: session.payment_intent as string,
        },
      });
      throw error;
    }

    await insertEventLog({
      eventType: "booking_checkout_started",
      payload: {
        driverId,
        listingId: payload.listingId,
        checkoutSessionId: session.id,
      },
    });

    res.status(201).json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error: any) {
    if (isSlotConflictError(error)) {
      return res.status(409).json({ message: "Time slot already booked" });
    }
    next(error);
  }
});

router.post("/promo/validate", requireAuth, bookingReadLimiter, async (req, res, next) => {
  try {
    const payload = promoValidateSchema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const listingWithHost = await getListingWithHostAccount(payload.listingId);
    if (!listingWithHost) {
      return res.status(404).json({ message: "Listing not found" });
    }
    const parkingCents = calculateListingChargeCents({
      rateType: listingWithHost.rateType,
      pricePerDay: listingWithHost.pricePerDay,
      pricePerHour: listingWithHost.pricePerHour,
      startTime: new Date(payload.from),
      endTime: new Date(payload.to),
    });
    const amountCents = Math.round(parkingCents * 1.08);
    const result = await validatePromoForBooking({
      code: payload.code,
      userId: driverId,
      amountCents,
    });
    if (!result.ok) {
      return res.status(422).json({ message: result.message });
    }
    res.json({
      code: result.promo.code,
      description: result.promo.description,
      discountType: result.promo.discount_type,
      discountValue: result.promo.discount_value,
      discountCents: result.discountCents,
      finalCents: result.finalCents,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/payment-intent", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const payload = paymentIntentSchema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const settings = await getFraudSettings();
    const enforceFraud = shouldEnforceFraud(settings);
    const profile = await getUserRiskProfile(driverId);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    if (profile.status === "suspended") {
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }
    if (!profile.email_verified) {
      return res.status(403).json({ message: "Please verify your email before booking." });
    }
    const accountAgeMinutes = (Date.now() - new Date(profile.created_at).getTime()) / 60000;
    if (accountAgeMinutes < settings.minAccountAgeMinutes) {
      if (enforceFraud) {
        return res.status(429).json({ message: "Please wait a few minutes before booking." });
      }
      console.warn("[fraud] booking account age below threshold", {
        userId: driverId,
        accountAgeMinutes,
        minAccountAgeMinutes: settings.minAccountAgeMinutes,
      });
    }
    const recent = await getRecentBookingStats(driverId);
    if (recent.count >= settings.maxBookingsPerDay) {
      if (enforceFraud) {
        return res.status(429).json({ message: "Booking limit reached. Try again later." });
      }
      console.warn("[fraud] booking count above threshold", {
        userId: driverId,
        count: recent.count,
        maxBookingsPerDay: settings.maxBookingsPerDay,
      });
    }
    const listingWithHost = await getListingWithHostAccount(payload.listingId);
    if (!listingWithHost) {
      return res.status(404).json({ message: "Listing not found" });
    }
    if (listingWithHost.hostId === driverId) {
      return res.status(403).json({ message: "You cannot book your own listing." });
    }
    const expectedParkingCents = calculateListingChargeCents({
      rateType: listingWithHost.rateType,
      pricePerDay: listingWithHost.pricePerDay,
      pricePerHour: listingWithHost.pricePerHour,
      startTime: new Date(payload.from),
      endTime: new Date(payload.to),
    });
    const expectedAmountCents = Math.round(expectedParkingCents * 1.08);

    let promoCodeId: string | null = null;
    let promoCode: string | null = null;
    let discountCents = 0;
    if (payload.promoCode) {
      const promoResult = await validatePromoForBooking({
        code: payload.promoCode,
        userId: driverId,
        amountCents: expectedAmountCents,
      });
      if (!promoResult.ok) {
        return res.status(422).json({ message: promoResult.message });
      }
      promoCodeId = promoResult.promo.id;
      promoCode = promoResult.promo.code;
      discountCents = promoResult.discountCents;
    }
    const chargeAmountCents = expectedAmountCents - discountCents;

    if (payload.amountCents !== chargeAmountCents) {
      return res.status(400).json({ message: "Booking price is out of date. Please refresh and try again." });
    }

    if (recent.total_cents + chargeAmountCents > settings.maxAmountPerDayCents) {
      if (enforceFraud) {
        return res.status(429).json({ message: "Daily booking limit reached." });
      }
      console.warn("[fraud] booking spend above threshold", {
        userId: driverId,
        totalCents: recent.total_cents,
        attemptedCents: chargeAmountCents,
        maxAmountPerDayCents: settings.maxAmountPerDayCents,
      });
    }

    const capacityCheck = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM bookings
          WHERE listing_id = $1
            AND (status IS NULL OR status <> 'canceled')
            AND tstzrange(start_time, end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
         ) AS booked_count,
         COALESCE(capacity, 1) AS capacity
       FROM listings WHERE id = $1 LIMIT 1`,
      [payload.listingId, payload.from, payload.to]
    );

    const capacityRow = capacityCheck.rows[0];
    if (capacityRow && Number(capacityRow.booked_count) >= Number(capacityRow.capacity)) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const user = await findUserById(driverId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const payoutAvailableAt = new Date(
      new Date(payload.from).getTime() + 24 * 60 * 60 * 1000
    );
    const customerId = await getOrCreateCustomer(user);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );

    // The platform funds the promo: the fee shrinks by the discount so the
    // host's payout (charge minus fee) stays based on the undiscounted price.
    const platformFeeCents =
      Math.round(expectedAmountCents * PLATFORM_FEE_PERCENT) - discountCents;
    const intentParams: any = {
      amount: chargeAmountCents,
      currency: payload.currency,
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        listing_id: payload.listingId,
        driver_id: driverId,
        start_time: payload.from,
        end_time: payload.to,
        platform_fee_cents: String(platformFeeCents),
        host_account_id: listingWithHost?.hostStripeAccountId ?? "",
        amount_cents: String(chargeAmountCents),
        currency: payload.currency,
        manual_review: settings.manualReview ? "true" : "false",
        source: "payment_intent",
        ...(promoCode
          ? { promo_code: promoCode, discount_cents: String(discountCents) }
          : {}),
      },
    };

    const intent = await stripe.paymentIntents.create(intentParams);

    try {
      await createBooking({
        listingId: payload.listingId,
        driverId,
        from: payload.from,
        to: payload.to,
        stripePaymentIntentId: intent.id,
        checkoutSessionId: null,
        amountCents: chargeAmountCents,
        currency: payload.currency,
        platformFeeCents,
        payoutAvailableAt,
        vehiclePlate: payload.vehiclePlate ? payload.vehiclePlate.toUpperCase() : null,
        promoCodeId,
        discountCents,
      });
    } catch (error) {
      try {
        await stripe.paymentIntents.cancel(intent.id);
      } catch (cancelError) {
        console.warn("Failed to cancel payment intent after booking persistence failure", cancelError);
      }
      // A slot conflict here is an expected concurrency outcome (someone grabbed
      // the last space first), not a system failure — the outer catch turns it
      // into a clean 409, so don't page on-call for it.
      if (!isSlotConflictError(error)) {
        await reportOperationalAlert({
          source: "booking-create",
          title: "Payment intent created but booking persistence failed",
          payload: {
            driverId,
            listingId: payload.listingId,
            paymentIntentId: intent.id,
          },
        });
      }
      throw error;
    }

    await insertEventLog({
      eventType: "booking_payment_intent_created",
      payload: {
        driverId,
        listingId: payload.listingId,
        paymentIntentId: intent.id,
      },
    });

    res.json({
      paymentIntentClientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
    });
  } catch (error: any) {
    if (isSlotConflictError(error)) {
      return res.status(409).json({ message: "Time slot already booked" });
    }
    next(error);
  }
});

router.post("/portal", enforceBlockedList, portalBookingLimiter, async (req, res, next) => {
  try {
    const payload = portalBookingSchema.parse(req.body);
    const startAt = new Date();
    const endAt = new Date(payload.until);
    if (Number.isNaN(endAt.getTime()) || endAt.getTime() <= startAt.getTime()) {
      return res.status(400).json({ message: "End time must be in the future" });
    }

    // Scoped to the same vehicle plate — this is an unauthenticated QR-code
    // flow, so without the plate filter any visitor requesting an overlapping
    // window on the same listing would be handed back a DIFFERENT visitor's
    // live Checkout session and could pay into their booking (the payment
    // would confirm the ORIGINAL visitor's plate, not the payer's).
    const existingPortal = await pool.query(
      `SELECT checkout_session_id
       FROM bookings
       WHERE listing_id = $1
         AND (status IS NULL OR status <> 'canceled')
         AND checkout_session_id IS NOT NULL
         AND vehicle_plate = $4
         AND tstzrange(start_time, end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
       ORDER BY created_at DESC
       LIMIT 1`,
      [payload.listingId, startAt.toISOString(), endAt.toISOString(), payload.vehiclePlate.toUpperCase()]
    );
    const existingSessionId = existingPortal.rows[0]?.checkout_session_id as string | undefined;
    if (existingSessionId && stripe) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(existingSessionId);
        if (existingSession?.url) {
          return res.status(200).json({ checkoutUrl: existingSession.url, sessionId: existingSessionId });
        }
      } catch (err) {
        // If the session no longer exists in Stripe, fall through to create a new one.
      }
    }

    const portalCapacityCheck = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM bookings
          WHERE listing_id = $1
            AND (status IS NULL OR status <> 'canceled')
            AND tstzrange(start_time, end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
         ) AS booked_count,
         COALESCE(capacity, 1) AS capacity
       FROM listings WHERE id = $1 LIMIT 1`,
      [payload.listingId, startAt.toISOString(), endAt.toISOString()]
    );
    const portalCapacityRow = portalCapacityCheck.rows[0];
    if (portalCapacityRow && Number(portalCapacityRow.booked_count) >= Number(portalCapacityRow.capacity)) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const listingWithHost = await getListingWithHostAccount(payload.listingId);
    if (!listingWithHost) {
      return res.status(404).json({ message: "Listing not found" });
    }

    const amountCents = calculateListingChargeCents({
      rateType: listingWithHost.rateType,
      pricePerDay: listingWithHost.pricePerDay,
      pricePerHour: listingWithHost.pricePerHour,
      startTime: startAt,
      endTime: endAt,
    });
    const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PERCENT);
    const payoutAvailableAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

    const driverId = await getOrCreatePortalGuestUserId();
    const settings = await getFraudSettings();
    const session = await createCheckoutSession({
      amount: amountCents,
      currency: "eur",
      listingId: payload.listingId,
      hostStripeAccountId: listingWithHost.hostStripeAccountId ?? null,
      platformFeePercent: PLATFORM_FEE_PERCENT,
      successUrl: `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/booking/cancel?session_id={CHECKOUT_SESSION_ID}`,
      driverId,
      manualReview: settings.manualReview,
      source: "portal",
      idempotencyKey: buildBookingIntentKey({
        source: "portal",
        driverId,
        listingId: payload.listingId,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
        amountCents,
        currency: "eur",
      }),
    });

    await createBooking({
      listingId: payload.listingId,
      driverId,
      from: startAt.toISOString(),
      to: endAt.toISOString(),
      stripePaymentIntentId: session.payment_intent as string,
      checkoutSessionId: session.id,
      amountCents,
      currency: "eur",
      platformFeeCents,
      payoutAvailableAt,
      vehiclePlate: payload.vehiclePlate.toUpperCase(),
    });

    res.status(201).json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error: any) {
    if (isSlotConflictError(error)) {
      return res.status(409).json({ message: "Time slot already booked" });
    }
    next(error);
  }
});

router.post("/:id/extend-intent", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const bookingId = z.string().uuid().parse(req.params.id);
    const schema = z.object({
      newEndTime: z.string().datetime(),
    });
    const { newEndTime } = schema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveDriver(driverId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });

    const booking = await getBookingForExtension({ bookingId, driverId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be extended" });
    }

    const currentEnd = new Date(booking.end_time);
    const startTime = new Date(booking.start_time);
    const requestedEnd = new Date(newEndTime);
    if (Number.isNaN(requestedEnd.getTime())) {
      return res.status(400).json({ message: "Invalid end time" });
    }
    if (requestedEnd.getTime() <= currentEnd.getTime()) {
      return res.status(400).json({ message: "New end time must be after current end time" });
    }

    const overlapCheck = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = $1
         AND id <> $2
         AND (status IS NULL OR status <> 'canceled')
         AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
       LIMIT 1`,
      [booking.listing_id, booking.id, booking.start_time, requestedEnd.toISOString()]
    );
    if (overlapCheck.rowCount && overlapCheck.rowCount > 0) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const newTotalCents = calculateListingChargeCents({
      rateType: booking.rate_type,
      pricePerDay: booking.price_per_day,
      pricePerHour: booking.price_per_hour,
      startTime,
      endTime: requestedEnd,
    });
    const currentTotalCents =
      booking.amount_cents ??
      calculateListingChargeCents({
        rateType: booking.rate_type,
        pricePerDay: booking.price_per_day,
        pricePerHour: booking.price_per_hour,
        startTime,
        endTime: currentEnd,
      });
    const effectiveTotalCents = Math.max(currentTotalCents, newTotalCents);
    const additionalAmountCents = effectiveTotalCents - currentTotalCents;

    if (additionalAmountCents <= 0) {
      try {
        const updated = await updateBookingExtension({
          bookingId,
          driverId,
          newEndTime: requestedEnd.toISOString(),
          newAmountCents: effectiveTotalCents,
        });
        if (!updated) {
          return res.status(400).json({ message: "Booking cannot be extended" });
        }
        return res.json({
          noCharge: true,
          newEndTime: requestedEnd.toISOString(),
          newTotalCents: effectiveTotalCents,
        });
      } catch (error: any) {
        if (isSlotConflictError(error)) {
          return res.status(409).json({ message: "Time slot already booked" });
        }
        throw error;
      }
    }

    const user = await findUserById(driverId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );
    const settings = await getFraudSettings();

    const intent = await stripe.paymentIntents.create({
      amount: additionalAmountCents,
      currency: (booking.currency ?? "eur").toLowerCase(),
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        booking_id: bookingId,
        driver_id: driverId,
        listing_id: booking.listing_id,
        amount_cents: String(additionalAmountCents),
        currency: (booking.currency ?? "eur").toLowerCase(),
        type: "extension",
        // Lets the webhook apply the extension if the client's confirm call
        // never arrives (app killed after paying in the sheet).
        new_end_time: requestedEnd.toISOString(),
        new_total_cents: String(effectiveTotalCents),
        manual_review: settings.manualReview ? "true" : "false",
        source: "extend_intent",
      },
    });

    res.json({
      paymentIntentClientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
      additionalAmountCents,
      newTotalCents: effectiveTotalCents,
      newEndTime: requestedEnd.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/extend-confirm", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const bookingId = z.string().uuid().parse(req.params.id);
    const schema = z.object({
      paymentIntentId: z.string().trim().min(5).max(200),
      newEndTime: z.string().datetime(),
      newTotalCents: z.number().int().positive().max(10000000),
    });
    // newTotalCents is accepted for backward compatibility but never trusted —
    // the charge is recomputed from the listing below.
    const { paymentIntentId, newEndTime } = schema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveDriver(driverId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });

    const booking = await getBookingForExtension({ bookingId, driverId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be extended" });
    }

    const currentEnd = new Date(booking.end_time);
    const startTime = new Date(booking.start_time);
    const requestedEnd = new Date(newEndTime);
    if (Number.isNaN(requestedEnd.getTime())) {
      return res.status(400).json({ message: "Invalid end time" });
    }
    if (requestedEnd.getTime() <= currentEnd.getTime()) {
      // The payment_intent.succeeded webhook may have already applied this
      // extension before the client's confirm call arrived. That's a success.
      const applied = await pool.query(
        `SELECT 1 FROM booking_payments WHERE payment_intent_id = $1 AND booking_id = $2 LIMIT 1`,
        [paymentIntentId, bookingId]
      );
      if (applied.rowCount && applied.rowCount > 0) {
        return res.json({
          ok: true,
          alreadyApplied: true,
          newEndTime: currentEnd.toISOString(),
          newTotalCents: booking.amount_cents,
        });
      }
      return res.status(400).json({ message: "New end time must be after current end time" });
    }

    // The slot may have been taken between extend-intent and now (the user was
    // in the payment sheet). Re-check before extending the window.
    const confirmOverlapCheck = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = $1
         AND id <> $2
         AND (status IS NULL OR status <> 'canceled')
         AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
       LIMIT 1`,
      [booking.listing_id, booking.id, booking.start_time, requestedEnd.toISOString()]
    );
    if (confirmOverlapCheck.rowCount && confirmOverlapCheck.rowCount > 0) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    // Recompute the charge server-side instead of trusting the client. This
    // mirrors /extend-intent so the new total and the additional charge owed
    // are derived from the listing's pricing, not from the request body.
    const recalculatedTotalCents = calculateListingChargeCents({
      rateType: booking.rate_type,
      pricePerDay: booking.price_per_day,
      pricePerHour: booking.price_per_hour,
      startTime,
      endTime: requestedEnd,
    });
    const currentTotalCents =
      booking.amount_cents ??
      calculateListingChargeCents({
        rateType: booking.rate_type,
        pricePerDay: booking.price_per_day,
        pricePerHour: booking.price_per_hour,
        startTime,
        endTime: currentEnd,
      });
    const effectiveTotalCents = Math.max(currentTotalCents, recalculatedTotalCents);
    const additionalAmountCents = effectiveTotalCents - currentTotalCents;

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["charges.data.balance_transaction"],
    });
    if (intent.status !== "succeeded") {
      return res.status(400).json({ message: `Payment not completed (${intent.status})` });
    }
    // The intent must belong to this booking's extension and cover the
    // recomputed additional charge — otherwise a driver could reuse an
    // unrelated payment, or pay for a short extension and claim a long one.
    if (intent.metadata?.booking_id !== bookingId || intent.metadata?.type !== "extension") {
      return res.status(400).json({ message: "Payment does not match this booking" });
    }
    if (intent.amount < additionalAmountCents) {
      return res.status(400).json({ message: "Payment does not cover the requested extension" });
    }

    try {
      const updated = await updateBookingExtension({
        bookingId,
        driverId,
        newEndTime: requestedEnd.toISOString(),
        newAmountCents: effectiveTotalCents,
        receiptUrl: (intent as any).charges?.data?.[0]?.receipt_url ?? null,
      });
      if (!updated) {
        return res.status(400).json({ message: "Booking cannot be extended" });
      }
      // Record the top-up so cancellation refunds cover it. The booking's own
      // payment_intent_id stays pointed at the original charge.
      await insertBookingPayment({
        bookingId,
        paymentIntentId,
        amountCents: intent.amount,
        currency: intent.currency ?? "eur",
        kind: "extension",
      });
      res.json({
        ok: true,
        newEndTime: updated.end_time.toISOString(),
        newTotalCents: updated.amount_cents,
      });
    } catch (error: any) {
      if (isSlotConflictError(error)) {
        return res.status(409).json({ message: "Time slot already booked" });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.post("/:id/change-intent", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const bookingId = z.string().uuid().parse(req.params.id);
    const schema = z.object({
      newStartTime: z.string().datetime(),
      newEndTime: z.string().datetime(),
    });
    const { newStartTime, newEndTime } = schema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveDriver(driverId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });

    const booking = await getBookingForExtension({ bookingId, driverId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be updated" });
    }

    const currentEnd = new Date(booking.end_time);
    const requestedStart = new Date(newStartTime);
    const requestedEnd = new Date(newEndTime);
    if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(requestedEnd.getTime())) {
      return res.status(400).json({ message: "Invalid booking times" });
    }
    if (requestedEnd.getTime() <= requestedStart.getTime()) {
      return res.status(400).json({ message: "End time must be after start time" });
    }
    if (requestedStart.getTime() < Date.now() - 5 * 60 * 1000) {
      return res.status(400).json({ message: "Start time must be in the future" });
    }
    if (currentEnd.getTime() <= Date.now()) {
      return res.status(400).json({ message: "Only upcoming bookings can be updated" });
    }

    const overlapCheck = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = $1
         AND id <> $2
         AND (status IS NULL OR status <> 'canceled')
         AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
       LIMIT 1`,
      [booking.listing_id, booking.id, requestedStart.toISOString(), requestedEnd.toISOString()]
    );
    if (overlapCheck.rowCount && overlapCheck.rowCount > 0) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const newTotalCents = calculateListingChargeCents({
      rateType: booking.rate_type,
      pricePerDay: booking.price_per_day,
      pricePerHour: booking.price_per_hour,
      startTime: requestedStart,
      endTime: requestedEnd,
    });
    const currentTotalCents =
      booking.amount_cents ??
      calculateListingChargeCents({
        rateType: booking.rate_type,
        pricePerDay: booking.price_per_day,
        pricePerHour: booking.price_per_hour,
        startTime: new Date(booking.start_time),
        endTime: currentEnd,
      });
    const effectiveTotalCents = Math.max(currentTotalCents, newTotalCents);
    const additionalAmountCents = effectiveTotalCents - currentTotalCents;

    if (additionalAmountCents === 0) {
      try {
        const updated = await updateBookingWindow({
          bookingId,
          driverId,
          newStartTime: requestedStart.toISOString(),
          newEndTime: requestedEnd.toISOString(),
          newAmountCents: effectiveTotalCents,
        });
        if (!updated) {
          return res.status(400).json({ message: "Booking cannot be updated" });
        }
        return res.json({
          noCharge: true,
          newStartTime: requestedStart.toISOString(),
          newEndTime: requestedEnd.toISOString(),
          newTotalCents: effectiveTotalCents,
        });
      } catch (error: any) {
        if (isSlotConflictError(error)) {
          return res.status(409).json({ message: "Time slot already booked" });
        }
        throw error;
      }
    }

    const user = await findUserById(driverId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );
    const settings = await getFraudSettings();

    const intent = await stripe.paymentIntents.create({
      amount: additionalAmountCents,
      currency: (booking.currency ?? "eur").toLowerCase(),
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        booking_id: bookingId,
        driver_id: driverId,
        listing_id: booking.listing_id,
        amount_cents: String(additionalAmountCents),
        currency: (booking.currency ?? "eur").toLowerCase(),
        type: "change",
        // Lets the webhook apply the change if the client's confirm call
        // never arrives (app killed after paying in the sheet).
        new_start_time: requestedStart.toISOString(),
        new_end_time: requestedEnd.toISOString(),
        new_total_cents: String(effectiveTotalCents),
        manual_review: settings.manualReview ? "true" : "false",
        source: "change_intent",
      },
    });

    res.json({
      paymentIntentClientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
      additionalAmountCents,
      newTotalCents: effectiveTotalCents,
      newStartTime: requestedStart.toISOString(),
      newEndTime: requestedEnd.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/change-confirm", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const bookingId = z.string().uuid().parse(req.params.id);
    const schema = z.object({
      paymentIntentId: z.string().trim().min(5).max(200),
      newStartTime: z.string().datetime(),
      newEndTime: z.string().datetime(),
      newTotalCents: z.number().int().positive().max(10000000),
    });
    // newTotalCents is accepted for backward compatibility but never trusted —
    // the charge is recomputed from the listing below, mirroring /extend-confirm.
    const { paymentIntentId, newStartTime, newEndTime } = schema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveDriver(driverId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });

    const booking = await getBookingForExtension({ bookingId, driverId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be updated" });
    }

    const requestedStart = new Date(newStartTime);
    const requestedEnd = new Date(newEndTime);
    if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(requestedEnd.getTime())) {
      return res.status(400).json({ message: "Invalid booking times" });
    }
    if (requestedEnd.getTime() <= requestedStart.getTime()) {
      return res.status(400).json({ message: "End time must be after start time" });
    }
    if (
      new Date(booking.start_time).getTime() === requestedStart.getTime() &&
      new Date(booking.end_time).getTime() === requestedEnd.getTime()
    ) {
      // The payment_intent.succeeded webhook may have already applied this
      // change before the client's confirm call arrived. That's a success.
      const applied = await pool.query(
        `SELECT 1 FROM booking_payments WHERE payment_intent_id = $1 AND booking_id = $2 LIMIT 1`,
        [paymentIntentId, bookingId]
      );
      if (applied.rowCount && applied.rowCount > 0) {
        return res.json({
          ok: true,
          alreadyApplied: true,
          newStartTime: requestedStart.toISOString(),
          newEndTime: requestedEnd.toISOString(),
          newTotalCents: booking.amount_cents,
        });
      }
    }

    // The slot may have been taken between change-intent and now (the user was
    // in the payment sheet). Re-check before moving the window.
    const overlapCheck = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = $1
         AND id <> $2
         AND (status IS NULL OR status <> 'canceled')
         AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
       LIMIT 1`,
      [booking.listing_id, booking.id, requestedStart.toISOString(), requestedEnd.toISOString()]
    );
    if (overlapCheck.rowCount && overlapCheck.rowCount > 0) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    // Recompute the charge server-side instead of trusting the client, exactly
    // as /change-intent priced it.
    const recalculatedTotalCents = calculateListingChargeCents({
      rateType: booking.rate_type,
      pricePerDay: booking.price_per_day,
      pricePerHour: booking.price_per_hour,
      startTime: requestedStart,
      endTime: requestedEnd,
    });
    const currentTotalCents =
      booking.amount_cents ??
      calculateListingChargeCents({
        rateType: booking.rate_type,
        pricePerDay: booking.price_per_day,
        pricePerHour: booking.price_per_hour,
        startTime: new Date(booking.start_time),
        endTime: new Date(booking.end_time),
      });
    const effectiveTotalCents = Math.max(currentTotalCents, recalculatedTotalCents);
    const additionalAmountCents = effectiveTotalCents - currentTotalCents;

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["charges.data.balance_transaction"],
    });
    if (intent.status !== "succeeded") {
      return res.status(400).json({ message: `Payment not completed (${intent.status})` });
    }
    // The intent must belong to this booking's change and cover the recomputed
    // additional charge — otherwise a driver could reuse an unrelated payment,
    // or pay for a small change and claim a bigger window.
    if (intent.metadata?.booking_id !== bookingId || intent.metadata?.type !== "change") {
      return res.status(400).json({ message: "Payment does not match this booking" });
    }
    if (intent.amount < additionalAmountCents) {
      return res.status(400).json({ message: "Payment does not cover the requested change" });
    }

    try {
      const updated = await updateBookingWindow({
        bookingId,
        driverId,
        newStartTime: requestedStart.toISOString(),
        newEndTime: requestedEnd.toISOString(),
        newAmountCents: effectiveTotalCents,
        receiptUrl: (intent as any).charges?.data?.[0]?.receipt_url ?? null,
      });
      if (!updated) {
        return res.status(400).json({ message: "Booking cannot be updated" });
      }
      // Record the top-up so cancellation refunds cover it. The booking's own
      // payment_intent_id stays pointed at the original charge.
      await insertBookingPayment({
        bookingId,
        paymentIntentId,
        amountCents: intent.amount,
        currency: intent.currency ?? "eur",
        kind: "change",
      });
      res.json({
        ok: true,
        newStartTime: updated.start_time.toISOString(),
        newEndTime: updated.end_time.toISOString(),
        newTotalCents: updated.amount_cents,
      });
    } catch (error: any) {
      if (isSlotConflictError(error)) {
        return res.status(409).json({ message: "Time slot already booked" });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.post("/confirm", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    const schema = z.object({
      paymentIntentId: z.string().trim().min(5).max(200),
      status: z.enum(["confirmed", "canceled"]).optional(),
    });
    const { paymentIntentId, status = "confirmed" } = schema.parse(req.body);
    const confirmUserId = req.user?.userId;
    if (!confirmUserId) return res.status(401).json({ message: "Unauthorized" });
    let receiptUrl: string | null = null;
    let booking:
      | { id: string; listing_id: string; driver_id: string; start_time: Date; end_time: Date }
      | undefined;
    if (status === "confirmed") {
      const bookingRow = await pool.query(
        `
        SELECT id, listing_id, driver_id, start_time, end_time
        FROM bookings
        WHERE payment_intent_id = $1
        LIMIT 1
        `,
        [paymentIntentId]
      );
      booking = bookingRow.rows[0] as
        | { id: string; listing_id: string; driver_id: string; start_time: Date; end_time: Date }
        | undefined;
      if (!booking && stripe) {
        try {
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
          const listingId = intent.metadata?.listing_id?.trim() ?? "";
          const driverId = intent.metadata?.driver_id?.trim() ?? "";
          const startTime = intent.metadata?.start_time?.trim() ?? "";
          const endTime = intent.metadata?.end_time?.trim() ?? "";
          const amountCents = Number(intent.metadata?.amount_cents ?? intent.amount ?? 0);
          const currency = (intent.metadata?.currency ?? intent.currency ?? "").trim().toLowerCase();
          if (listingId && driverId && startTime && endTime && amountCents > 0 && currency) {
            const fallbackRow = await pool.query(
              `
              SELECT id, listing_id, driver_id, start_time, end_time
              FROM bookings
              WHERE listing_id = $1
                AND driver_id = $2
                AND start_time = $3::timestamptz
                AND end_time = $4::timestamptz
                AND amount_cents = $5
                AND lower(currency) = $6
                AND (status IS NULL OR status = 'pending')
              ORDER BY created_at DESC
              LIMIT 1
              `,
              [listingId, driverId, startTime, endTime, amountCents, currency]
            );
            booking = fallbackRow.rows[0] as
              | { id: string; listing_id: string; driver_id: string; start_time: Date; end_time: Date }
              | undefined;
            if (booking) {
              await pool.query(
                `
                UPDATE bookings
                SET payment_intent_id = $1
                WHERE id = $2
                  AND (payment_intent_id IS NULL OR payment_intent_id <> $1)
                `,
                [paymentIntentId, booking.id]
              );
              await insertEventLog({
                eventType: "booking_confirm_relinked",
                payload: {
                  paymentIntentId,
                  bookingId: booking.id,
                  listingId,
                  driverId,
                },
              });
            }
          }
        } catch (fallbackError) {
          console.warn("Booking confirm fallback lookup failed", fallbackError);
        }
      }
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      // Only the driver who owns the booking may confirm it.
      if (booking.driver_id !== confirmUserId) {
        return res.status(404).json({ message: "Booking not found" });
      }
      const confirmCapacityCheck = await pool.query(
        `
        SELECT
          (SELECT COUNT(*) FROM bookings
           WHERE listing_id = $1
          AND id <> $2
          AND (status IS NULL OR status <> 'canceled')
          AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
         ) AS booked_count,
         COALESCE(capacity, 1) AS capacity
        FROM listings WHERE id = $1 LIMIT 1
        `,
        [booking.listing_id, booking.id, booking.start_time, booking.end_time]
      );
      const confirmCapacityRow = confirmCapacityCheck.rows[0];
      if (confirmCapacityRow && Number(confirmCapacityRow.booked_count) >= Number(confirmCapacityRow.capacity)) {
        await updateBookingStatusByPaymentIntent({
          paymentIntentId,
          status: "canceled",
        });
        return res.status(409).json({ message: "Time slot already booked" });
      }
    }
    if (status === "confirmed" && stripe) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["charges.data.balance_transaction"],
      });
      if (intent.status !== "succeeded") {
        return res.status(400).json({ message: `Payment not completed (${intent.status})` });
      }
      receiptUrl = (intent as any).charges?.data?.[0]?.receipt_url ?? null;
    }
    const existingBooking = await getBookingByPaymentIntent(paymentIntentId);
    // The cancel path never went through the ownership check above — a caller
    // must not be able to cancel someone else's booking via its intent id.
    if (existingBooking && existingBooking.driver_id !== confirmUserId) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const shouldNotifyCanceledTransition = status === "confirmed" || existingBooking?.status === "confirmed";
    const ok = await updateBookingStatusByPaymentIntent({ paymentIntentId, status, receiptUrl });
    if (!ok) {
      const existing = await getBookingByPaymentIntent(paymentIntentId);
      // The Stripe payment_intent.succeeded webhook may have already confirmed
      // this booking before the client's confirm call arrived. That's a success,
      // not a failure — return ok so the app doesn't show a scary error.
      if (status === "confirmed" && existing?.status === "confirmed") {
        return res.json({ ok: true, alreadyConfirmed: true });
      }
      if (existing?.status === "canceled") {
        return res.status(409).json({ message: "Booking already canceled" });
      }
      return res.status(404).json({ message: "Booking not found" });
    }
    const targets = await getBookingNotificationTargetsByPaymentIntent(paymentIntentId);
    if (targets) {
      if (status === "confirmed") {
        await sendBookingStatusPush({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          hostId: targets.host_id,
          listingTitle: targets.listing_title,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
          status,
        });
        await sendDriverBookingLifecycleEmail({
          driverEmail: targets.driver_email,
          status,
          bookingId: targets.booking_id,
          listingTitle: targets.listing_title,
          listingAddress: targets.listing_address,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
          receiptUrl,
          accessCode: targets.access_code,
          arrivalInstructions: targets.arrival_instructions,
          amountCents: targets.amount_cents,
          vehiclePlate: targets.vehicle_plate,
        });
        await scheduleBookingNotifications({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
        });
      } else {
        if (shouldNotifyCanceledTransition) {
          await sendBookingStatusPush({
            bookingId: targets.booking_id,
            driverId: targets.driver_id,
            hostId: targets.host_id,
            listingTitle: targets.listing_title,
            startTime: new Date(targets.start_time),
            endTime: new Date(targets.end_time),
            status,
          });
          await sendDriverBookingLifecycleEmail({
            driverEmail: targets.driver_email,
            status,
            bookingId: targets.booking_id,
            listingTitle: targets.listing_title,
            listingAddress: targets.listing_address,
            startTime: new Date(targets.start_time),
            endTime: new Date(targets.end_time),
            receiptUrl,
            accessCode: targets.access_code,
            arrivalInstructions: targets.arrival_instructions,
          amountCents: targets.amount_cents,
          vehiclePlate: targets.vehicle_plate,
          });
        }
        await deleteScheduledNotificationsByBooking(targets.booking_id);
      }
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    const bookingId = z.string().uuid().parse(req.params.id);
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const booking = await getBookingForRefund({ bookingId, driverId: userId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status === "canceled") {
      return res.json({ ok: true, alreadyCanceled: true });
    }
    // Validate eligibility BEFORE touching Stripe. A booking whose window has
    // already ended can't be canceled at all (the DB update below also
    // enforces end_time > now(), but checking first stops us from refunding
    // money for a cancel that's about to be rejected anyway).
    const now = Date.now();
    if (now >= new Date(booking.end_time).getTime()) {
      return res.status(400).json({ message: "This booking has already ended and can no longer be canceled." });
    }
    // Free cancellation only applies before the booking starts. Canceling
    // after start_time (the driver is mid-stay) still releases the space but
    // does not refund time already used — otherwise a driver could book a
    // full day and cancel minutes before it ends for a full refund. A booking
    // that already has a refund recorded still routes through
    // refundBookingPayment (regardless of timing) so its idempotent
    // short-circuit can carry the existing refundId forward.
    const isBeforeStart = now < new Date(booking.start_time).getTime();
    const hasExistingRefund = booking.refund_status === "succeeded" || Boolean(booking.refund_id);

    let refundId: string | null = null;
    let alreadyRefunded = false;
    if (booking.status === "confirmed" && (isBeforeStart || hasExistingRefund)) {
      const refundResult = await refundBookingPayment({
        paymentIntentId: booking.payment_intent_id,
        bookingId,
        existingRefundId: booking.refund_id,
        existingRefundStatus: booking.refund_status,
        reason: "driver_cancellation",
      });
      refundId = refundResult.refundId;
      alreadyRefunded = refundResult.alreadyRefunded;
      // Extension/change top-ups are separate charges — refund them too.
      await refundBookingTopUpPayments({ bookingId, reason: "driver_cancellation" });
    }

    const ok = refundId || alreadyRefunded
      ? await cancelBookingWithRefund({ bookingId, driverId: userId, refundId })
      : await cancelBookingByDriver({ bookingId, driverId: userId });

    if (!ok) return res.status(400).json({ message: "Booking cannot be canceled" });
    await insertEventLog({
      eventType: "driver_booking_canceled",
      payload: {
        bookingId,
        driverId: userId,
        refundId,
        alreadyRefunded,
      },
    });
    const targets = await getBookingNotificationTargets(bookingId);
    if (targets) {
      await sendBookingStatusPush({
        bookingId: targets.booking_id,
        driverId: targets.driver_id,
        hostId: targets.host_id,
        listingTitle: targets.listing_title,
        startTime: new Date(targets.start_time),
        endTime: new Date(targets.end_time),
        status: "canceled",
      });
      await sendDriverBookingLifecycleEmail({
        driverEmail: targets.driver_email,
        status: "canceled",
        bookingId: targets.booking_id,
        listingTitle: targets.listing_title,
        listingAddress: targets.listing_address,
        startTime: new Date(targets.start_time),
        endTime: new Date(targets.end_time),
        accessCode: targets.access_code,
        arrivalInstructions: targets.arrival_instructions,
          amountCents: targets.amount_cents,
          vehiclePlate: targets.vehicle_plate,
      });
      await deleteScheduledNotificationsByBooking(targets.booking_id);
    }
    res.json({ ok: true, refunded: Boolean(refundId) || alreadyRefunded });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/host-cancel", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    const bookingId = z.string().uuid().parse(req.params.id);
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const booking = await getBookingForHostRefund({ bookingId, hostId: userId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status === "canceled") {
      return res.json({ ok: true, alreadyCanceled: true });
    }
    // Validate before touching Stripe — a completed booking can't be canceled,
    // full stop (see the matching guard in the driver /cancel route above).
    if (Date.now() >= new Date(booking.end_time).getTime()) {
      return res.status(400).json({ message: "This booking has already ended and can no longer be canceled." });
    }

    let refundId: string | null = null;
    let alreadyRefunded = false;
    if (booking.status === "confirmed") {
      const refundResult = await refundBookingPayment({
        paymentIntentId: booking.payment_intent_id,
        bookingId,
        existingRefundId: booking.refund_id,
        existingRefundStatus: booking.refund_status,
        reason: "host_cancellation",
      });
      refundId = refundResult.refundId;
      alreadyRefunded = refundResult.alreadyRefunded;
      // Extension/change top-ups are separate charges — refund them too.
      await refundBookingTopUpPayments({ bookingId, reason: "host_cancellation" });
    }

    const ok = await cancelBookingWithRefundByHost({ bookingId, hostId: userId, refundId });
    if (!ok) return res.status(400).json({ message: "Booking cannot be canceled" });

    await insertEventLog({
      eventType: "host_booking_canceled",
      payload: {
        bookingId,
        hostId: userId,
        refundId,
        alreadyRefunded,
      },
    });

    const targets = await getBookingNotificationTargets(bookingId);
    if (targets) {
      await sendBookingStatusPush({
        bookingId: targets.booking_id,
        driverId: targets.driver_id,
        hostId: targets.host_id,
        listingTitle: targets.listing_title,
        startTime: new Date(targets.start_time),
        endTime: new Date(targets.end_time),
        status: "canceled",
      });
      await sendDriverBookingLifecycleEmail({
        driverEmail: targets.driver_email,
        status: "canceled",
        bookingId: targets.booking_id,
        listingTitle: targets.listing_title,
        listingAddress: targets.listing_address,
        startTime: new Date(targets.start_time),
        endTime: new Date(targets.end_time),
        accessCode: targets.access_code,
        arrivalInstructions: targets.arrival_instructions,
          amountCents: targets.amount_cents,
          vehiclePlate: targets.vehicle_plate,
      });
      await deleteScheduledNotificationsByBooking(targets.booking_id);
    }

    res.json({ ok: true, refunded: Boolean(refundId) || alreadyRefunded });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/check-in", requireAuth, enforceBlockedList, bookingLimiter, async (req, res, next) => {
  try {
    const bookingId = z.string().uuid().parse(req.params.id);
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const checkedInAt = await checkInBooking({ bookingId, driverId: userId });
    if (!checkedInAt) {
      return res.status(400).json({ message: "Check-in not available" });
    }
    res.json({ ok: true, checkedInAt });
  } catch (error) {
    next(error);
  }
});

type CheckoutConfirmOutcome = "orphan" | "conflict" | "skipped" | "confirmed";

// Confirms a Checkout-based booking (keyed on checkout_session_id, whose
// payment_intent_id is only known once payment completes). Shared by the
// checkout.session.completed handler and — as a fallback — the
// payment_intent.succeeded handler, so a booking still confirms even if only
// one of those two events is delivered to the webhook endpoint.
async function confirmCheckoutSessionBooking(session: any): Promise<CheckoutConfirmOutcome> {
  const paymentIntentId = session.payment_intent as string;
  const bookingRow = await pool.query(
    `
    SELECT id, listing_id, start_time, end_time
    FROM bookings
    WHERE checkout_session_id = $1
    LIMIT 1
    `,
    [session.id]
  );
  const booking = bookingRow.rows[0] as
    | { id: string; listing_id: string; start_time: Date; end_time: Date }
    | undefined;
  if (!booking) {
    if (paymentIntentId) {
      await refundOrphanPayment({
        paymentIntentId,
        referenceId: session.id,
        source: "checkout.session.completed",
      });
    } else {
      await reportOperationalAlert({
        source: "stripe-webhook",
        title: "Checkout session completed without booking or payment intent",
        payload: { checkoutSessionId: session.id },
      });
    }
    return "orphan";
  }

  const conflict = await hasBookingOverlap({
    listingId: booking.listing_id,
    bookingId: booking.id,
    startTime: booking.start_time,
    endTime: booking.end_time,
  });
  if (conflict) {
    const conflictPayload = {
      bookingId: booking.id,
      listingId: booking.listing_id,
      paymentIntentId,
      source: "checkout.session.completed",
    };
    console.warn("Booking conflict on checkout.session.completed", conflictPayload);
    await insertEventLog({ eventType: "booking_conflict", payload: conflictPayload });
    if (paymentIntentId) {
      await refundBookingPayment({
        paymentIntentId,
        bookingId: booking.id,
        reason: "booking_conflict",
      });
    }
    await updateBookingStatus({
      checkoutSessionId: session.id,
      status: "canceled",
      paymentIntentId,
    });
    const conflictTargets = await getBookingNotificationTargetsByCheckoutSession(session.id);
    if (conflictTargets) {
      await sendBookingStatusPush({
        bookingId: conflictTargets.booking_id,
        driverId: conflictTargets.driver_id,
        hostId: conflictTargets.host_id,
        listingTitle: conflictTargets.listing_title,
        startTime: new Date(conflictTargets.start_time),
        endTime: new Date(conflictTargets.end_time),
        status: "canceled",
      });
      await sendDriverBookingLifecycleEmail({
        driverEmail: conflictTargets.driver_email,
        status: "canceled",
        bookingId: conflictTargets.booking_id,
        listingTitle: conflictTargets.listing_title,
        listingAddress: conflictTargets.listing_address,
        startTime: new Date(conflictTargets.start_time),
        endTime: new Date(conflictTargets.end_time),
        accessCode: conflictTargets.access_code,
        arrivalInstructions: conflictTargets.arrival_instructions,
        amountCents: conflictTargets.amount_cents,
        vehiclePlate: conflictTargets.vehicle_plate,
      });
      await deleteScheduledNotificationsByBooking(conflictTargets.booking_id);
    }
    return "conflict";
  }

  let receiptUrl: string | null = null;
  if (stripe && session.payment_intent) {
    const intent = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
      expand: ["charges.data.balance_transaction"],
    });
    receiptUrl = (intent as any).charges?.data?.[0]?.receipt_url ?? null;
  }
  const updated = await updateBookingStatus({
    checkoutSessionId: session.id,
    status: "confirmed",
    paymentIntentId: session.payment_intent as string,
    receiptUrl,
  });
  if (!updated) {
    await insertEventLog({
      eventType: "booking_status_transition_skipped",
      payload: {
        source: "checkout.session.completed",
        checkoutSessionId: session.id,
        paymentIntentId: session.payment_intent as string,
        attemptedStatus: "confirmed",
      },
    });
    return "skipped";
  }
  await insertEventLog({
    eventType: "booking_confirmed",
    payload: {
      bookingId: booking.id,
      paymentIntentId: session.payment_intent as string,
      source: "checkout.session.completed",
    },
  });
  const targets = await getBookingNotificationTargetsByCheckoutSession(session.id);
  if (targets) {
    await sendBookingStatusPush({
      bookingId: targets.booking_id,
      driverId: targets.driver_id,
      hostId: targets.host_id,
      listingTitle: targets.listing_title,
      startTime: new Date(targets.start_time),
      endTime: new Date(targets.end_time),
      status: "confirmed",
    });
    await sendDriverBookingLifecycleEmail({
      driverEmail: targets.driver_email,
      status: "confirmed",
      bookingId: targets.booking_id,
      listingTitle: targets.listing_title,
      listingAddress: targets.listing_address,
      startTime: new Date(targets.start_time),
      endTime: new Date(targets.end_time),
      receiptUrl,
      accessCode: targets.access_code,
      arrivalInstructions: targets.arrival_instructions,
      amountCents: targets.amount_cents,
      vehiclePlate: targets.vehicle_plate,
    });
    await scheduleBookingNotifications({
      bookingId: targets.booking_id,
      driverId: targets.driver_id,
      startTime: new Date(targets.start_time),
      endTime: new Date(targets.end_time),
    });
  }
  return "confirmed";
}

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.warn("Stripe webhook skipped (missing secret or stripe client).");
    await reportOperationalAlert({
      source: "stripe-webhook",
      title: "Stripe webhook skipped",
      payload: {
        reason: !stripe ? "stripe_not_configured" : "missing_webhook_secret",
      },
    });
    return res.json({ received: true, skipped: true });
  }

  if (!signature) {
    return res.status(400).json({ message: "Missing signature" });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const outcome = await confirmCheckoutSessionBooking(session);
      if (outcome !== "confirmed") {
        return res.json({ received: true, [outcome]: true });
      }
    }

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as any;
      await updateBookingStatus({
        checkoutSessionId: session.id,
        status: "canceled",
        paymentIntentId: session.payment_intent as string,
      });
      const targets = await getBookingNotificationTargetsByCheckoutSession(session.id);
      if (targets) {
        await deleteScheduledNotificationsByBooking(targets.booking_id);
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as any;
      const paymentIntentId = intent.id as string;
      // Extension/change top-ups have no bookings.payment_intent_id row of
      // their own — route them to the dedicated handler instead of the orphan
      // path (which would refund a legitimate payment).
      if (intent.metadata?.type === "extension" || intent.metadata?.type === "change") {
        await handleTopUpPaymentSucceeded(intent);
        return res.json({ received: true, topUp: true });
      }
      const bookingRow = await pool.query(
        `
        SELECT id, listing_id, start_time, end_time
        FROM bookings
        WHERE payment_intent_id = $1
        LIMIT 1
        `,
        [paymentIntentId]
      );
      const booking = bookingRow.rows[0] as
        | { id: string; listing_id: string; start_time: Date; end_time: Date }
        | undefined;
      if (!booking) {
        // Checkout-based bookings are keyed on checkout_session_id and only
        // learn their payment_intent_id from checkout.session.completed. If that
        // event is delayed or not delivered to this endpoint, this PI looks
        // orphaned — so resolve the Checkout session for it and confirm the
        // booking through the shared path instead of refunding a real payment.
        let checkoutSession: any = null;
        try {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 1,
          });
          checkoutSession = sessions.data[0] ?? null;
        } catch (err) {
          console.warn("Failed to resolve checkout session for payment intent", paymentIntentId, err);
        }
        if (checkoutSession) {
          const outcome = await confirmCheckoutSessionBooking(checkoutSession);
          return res.json({ received: true, viaCheckoutSession: true, [outcome]: true });
        }
        await refundOrphanPayment({
          paymentIntentId,
          referenceId: paymentIntentId,
          source: "payment_intent.succeeded",
        });
        return res.json({ received: true, orphan: true });
      }
      if (booking) {
        const conflict = await hasBookingOverlap({
          listingId: booking.listing_id,
          bookingId: booking.id,
          startTime: booking.start_time,
          endTime: booking.end_time,
        });
        if (conflict) {
          const conflictPayload = {
            bookingId: booking.id,
            listingId: booking.listing_id,
            paymentIntentId,
            source: "payment_intent.succeeded",
          };
          console.warn("Booking conflict on payment_intent.succeeded", conflictPayload);
          await insertEventLog({
            eventType: "booking_conflict",
            payload: conflictPayload,
          });
          if (paymentIntentId) {
            await refundBookingPayment({
              paymentIntentId,
              bookingId: booking.id,
              reason: "booking_conflict",
            });
          }
          await updateBookingStatusByPaymentIntent({
            paymentIntentId,
            status: "canceled",
          });
          const conflictTargets = await getBookingNotificationTargetsByPaymentIntent(paymentIntentId);
          if (conflictTargets) {
            await sendBookingStatusPush({
              bookingId: conflictTargets.booking_id,
              driverId: conflictTargets.driver_id,
              hostId: conflictTargets.host_id,
              listingTitle: conflictTargets.listing_title,
              startTime: new Date(conflictTargets.start_time),
              endTime: new Date(conflictTargets.end_time),
              status: "canceled",
            });
            await sendDriverBookingLifecycleEmail({
              driverEmail: conflictTargets.driver_email,
              status: "canceled",
              bookingId: conflictTargets.booking_id,
              listingTitle: conflictTargets.listing_title,
              listingAddress: conflictTargets.listing_address,
              startTime: new Date(conflictTargets.start_time),
              endTime: new Date(conflictTargets.end_time),
              accessCode: conflictTargets.access_code,
              arrivalInstructions: conflictTargets.arrival_instructions,
              amountCents: conflictTargets.amount_cents,
              vehiclePlate: conflictTargets.vehicle_plate,
            });
            await deleteScheduledNotificationsByBooking(conflictTargets.booking_id);
          }
          return res.json({ received: true, conflict: true });
        }
      }
      const updated = await updateBookingStatusByPaymentIntent({
        paymentIntentId,
        status: "confirmed",
        receiptUrl: (intent as any).charges?.data?.[0]?.receipt_url ?? null,
      });
      if (!updated) {
        await insertEventLog({
          eventType: "booking_status_transition_skipped",
          payload: {
            source: "payment_intent.succeeded",
            paymentIntentId,
            attemptedStatus: "confirmed",
          },
        });
        return res.json({ received: true, skipped: true });
      }
      await insertEventLog({
        eventType: "booking_confirmed",
        payload: {
          bookingId: booking.id,
          paymentIntentId,
          source: "payment_intent.succeeded",
        },
      });
      const targets = await getBookingNotificationTargetsByPaymentIntent(paymentIntentId);
      if (targets) {
        await sendBookingStatusPush({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          hostId: targets.host_id,
          listingTitle: targets.listing_title,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
          status: "confirmed",
        });
        await sendDriverBookingLifecycleEmail({
          driverEmail: targets.driver_email,
          status: "confirmed",
          bookingId: targets.booking_id,
          listingTitle: targets.listing_title,
          listingAddress: targets.listing_address,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
          receiptUrl: (intent as any).charges?.data?.[0]?.receipt_url ?? null,
          accessCode: targets.access_code,
          arrivalInstructions: targets.arrival_instructions,
          amountCents: targets.amount_cents,
          vehiclePlate: targets.vehicle_plate,
        });
        await scheduleBookingNotifications({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
        });

        if (process.env.STRIPE_CONNECT_ENABLED === "true" && stripe) {
          const hostUser = await findUserById(targets.host_id);
          const accountId = hostUser?.host_stripe_account_id;
          if (accountId && !accountId.startsWith("acct_mock_")) {
            const due = await listDuePayoutsForHost(targets.host_id);
            for (const payoutBooking of due) {
              const locked = await markPayoutProcessing(payoutBooking.id);
              if (!locked) continue;
              const net = Math.max(0, Number(payoutBooking.amount_cents) - Number(payoutBooking.fee_cents));
              if (net <= 0) {
                await markPayoutPending(payoutBooking.id);
                continue;
              }
              try {
                const transfer = await stripe.transfers.create({
                  amount: net,
                  currency: (payoutBooking.currency ?? "eur").toLowerCase(),
                  destination: accountId,
                  metadata: { booking_id: payoutBooking.id },
                });
                await markPayoutTransferred({ bookingId: payoutBooking.id, transferId: transfer.id });
              } catch {
                await markPayoutPending(payoutBooking.id);
              }
            }
          }
        }
      }
    }

    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      const intent = event.data.object as any;
      await updateBookingStatusByPaymentIntent({
        paymentIntentId: intent.id,
        status: "canceled",
      });
      const targets = await getBookingNotificationTargetsByPaymentIntent(intent.id);
      if (targets) {
        await deleteScheduledNotificationsByBooking(targets.booking_id);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error", err);
    await insertEventLog({
      eventType: "stripe_webhook_failed",
      payload: {
        message: err instanceof Error ? err.message : "Unknown webhook error",
      },
    });
    await reportOperationalAlert({
      source: "stripe-webhook",
      title: "Stripe webhook processing failed",
      payload: {
        message: err instanceof Error ? err.message : "Unknown webhook error",
      },
    });
    return res.status(400).json({ message: "Invalid webhook" });
  }
});

router.get("/me", requireAuth, bookingReadLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const bookings = await listUserBookings(userId);
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireAuth, bookingReadLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const booking = await getBookingById(userId, req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

router.post("/connect-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const connectWebhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!stripe || !connectWebhookSecret) {
    return res.json({ received: true, skipped: true });
  }

  if (!signature) {
    return res.status(400).json({ message: "Missing signature" });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, signature, connectWebhookSecret);

    if (event.type === "account.updated") {
      const account = event.data.object as any;
      await insertEventLog({
        eventType: "connect_account_updated",
        payload: {
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
        },
      });
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Stripe Connect webhook error", err);
    return res.status(400).json({ message: "Invalid webhook" });
  }
});

export default router;
