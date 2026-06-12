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
} from "../lib/db.js";
import { createCheckoutSession, stripe } from "../lib/stripe.js";
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
  keyGenerator: (req) => req.ip ?? "unknown",
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
      accessCode: input.accessCode,
      arrivalInstructions: input.arrivalInstructions,
      receiptUrl: input.receiptUrl,
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
  // Always queue a "starting soon" reminder; if the booking is very soon, schedule it immediately.
  const scheduledStartSoon =
    startTime.getTime() > now + 5 * 60 * 1000
      ? startSoon.getTime() > now + 60 * 1000
        ? startSoon
        : new Date(now + 60 * 1000)
      : new Date(now + 10 * 1000);
  await insertScheduledNotification({
    userId: driverId,
    bookingId,
    type: "booking_start_soon",
    scheduledAt: scheduledStartSoon,
  });

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

async function getOrCreateCustomer(email: string) {
  if (!stripe) throw new Error("Stripe not configured");
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;
  const customer = await stripe.customers.create({ email });
  return customer.id;
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
    const expectedParkingCents = calculateListingChargeCents({
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

    const platformFeeCents = Math.round(expectedAmountCents * payload.platformFeePercent);
    const session = await createCheckoutSession({
      amount: expectedAmountCents,
      currency: payload.currency,
      listingId: payload.listingId,
      hostStripeAccountId: listingWithHost?.hostStripeAccountId ?? null,
      platformFeePercent: payload.platformFeePercent,
      successUrl: `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/booking/cancel?session_id={CHECKOUT_SESSION_ID}`,
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
    if (error?.code === "23P01") {
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
    const customerId = await getOrCreateCustomer(user.email);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );

    // The platform funds the promo: the fee shrinks by the discount so the
    // host's payout (charge minus fee) stays based on the undiscounted price.
    const platformFeeCents =
      Math.round(expectedAmountCents * payload.platformFeePercent) - discountCents;
    const intentParams: any = {
      amount: chargeAmountCents,
      currency: payload.currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        listing_id: payload.listingId,
        driver_id: driverId,
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
      await reportOperationalAlert({
        source: "booking-create",
        title: "Payment intent created but booking persistence failed",
        payload: {
          driverId,
          listingId: payload.listingId,
          paymentIntentId: intent.id,
        },
      });
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
    if (error?.code === "23P01") {
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

    const existingPortal = await pool.query(
      `SELECT checkout_session_id
       FROM bookings
       WHERE listing_id = $1
         AND (status IS NULL OR status <> 'canceled')
         AND checkout_session_id IS NOT NULL
         AND tstzrange(start_time, end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
       ORDER BY created_at DESC
       LIMIT 1`,
      [payload.listingId, startAt.toISOString(), endAt.toISOString()]
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
    const platformFeePercent = 8 / 108;
    const platformFeeCents = Math.round(amountCents * platformFeePercent);
    const payoutAvailableAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

    const driverId = await getOrCreatePortalGuestUserId();
    const settings = await getFraudSettings();
    const session = await createCheckoutSession({
      amount: amountCents,
      currency: "eur",
      listingId: payload.listingId,
      hostStripeAccountId: listingWithHost.hostStripeAccountId ?? null,
      platformFeePercent,
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
    if (error?.code === "23P01") {
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
        if (error?.code === "23P01") {
          return res.status(409).json({ message: "Time slot already booked" });
        }
        throw error;
      }
    }

    const user = await findUserById(driverId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user.email);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );
    const settings = await getFraudSettings();

    const intent = await stripe.paymentIntents.create({
      amount: additionalAmountCents,
      currency: (booking.currency ?? "eur").toLowerCase(),
      customer: customerId,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        booking_id: bookingId,
        driver_id: driverId,
        listing_id: booking.listing_id,
        amount_cents: String(additionalAmountCents),
        currency: (booking.currency ?? "eur").toLowerCase(),
        type: "extension",
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
      return res.status(400).json({ message: "New end time must be after current end time" });
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
        paymentIntentId,
        receiptUrl: (intent as any).charges?.data?.[0]?.receipt_url ?? null,
      });
      if (!updated) {
        return res.status(400).json({ message: "Booking cannot be extended" });
      }
      res.json({
        ok: true,
        newEndTime: updated.end_time.toISOString(),
        newTotalCents: updated.amount_cents,
      });
    } catch (error: any) {
      if (error?.code === "23P01") {
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
        if (error?.code === "23P01") {
          return res.status(409).json({ message: "Time slot already booked" });
        }
        throw error;
      }
    }

    const user = await findUserById(driverId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user.email);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );
    const settings = await getFraudSettings();

    const intent = await stripe.paymentIntents.create({
      amount: additionalAmountCents,
      currency: (booking.currency ?? "eur").toLowerCase(),
      customer: customerId,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        booking_id: bookingId,
        driver_id: driverId,
        listing_id: booking.listing_id,
        amount_cents: String(additionalAmountCents),
        currency: (booking.currency ?? "eur").toLowerCase(),
        type: "change",
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
    const { paymentIntentId, newStartTime, newEndTime, newTotalCents } = schema.parse(req.body);
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
    if (requestedEnd.getTime() <= requestedStart.getTime()) {
      return res.status(400).json({ message: "End time must be after start time" });
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["charges.data.balance_transaction"],
    });
    if (intent.status !== "succeeded") {
      return res.status(400).json({ message: `Payment not completed (${intent.status})` });
    }

    try {
      const updated = await updateBookingWindow({
        bookingId,
        driverId,
        newStartTime: requestedStart.toISOString(),
        newEndTime: requestedEnd.toISOString(),
        newAmountCents: newTotalCents,
        paymentIntentId,
        receiptUrl: (intent as any).charges?.data?.[0]?.receipt_url ?? null,
      });
      if (!updated) {
        return res.status(400).json({ message: "Booking cannot be updated" });
      }
      res.json({
        ok: true,
        newStartTime: updated.start_time.toISOString(),
        newEndTime: updated.end_time.toISOString(),
        newTotalCents: updated.amount_cents,
      });
    } catch (error: any) {
      if (error?.code === "23P01") {
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
    let receiptUrl: string | null = null;
    if (status === "confirmed") {
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
      if (!booking) return res.status(404).json({ message: "Booking not found" });
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
    const shouldNotifyCanceledTransition = status === "confirmed" || existingBooking?.status === "confirmed";
    const ok = await updateBookingStatusByPaymentIntent({ paymentIntentId, status, receiptUrl });
    if (!ok) {
      const existing = await getBookingByPaymentIntent(paymentIntentId);
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

    let refundId: string | null = null;
    let alreadyRefunded = false;
    if (booking.status === "confirmed") {
      const refundResult = await refundBookingPayment({
        paymentIntentId: booking.payment_intent_id,
        bookingId,
        existingRefundId: booking.refund_id,
        existingRefundStatus: booking.refund_status,
        reason: "driver_cancellation",
      });
      refundId = refundResult.refundId;
      alreadyRefunded = refundResult.alreadyRefunded;
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
            payload: {
              checkoutSessionId: session.id,
            },
          });
        }
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
            source: "checkout.session.completed",
          };
          console.warn("Booking conflict on checkout.session.completed", conflictPayload);
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
            });
            await deleteScheduledNotificationsByBooking(conflictTargets.booking_id);
          }
          return res.json({ received: true, conflict: true });
        }
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
        return res.json({ received: true, skipped: true });
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
        });
        await scheduleBookingNotifications({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
        });
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
