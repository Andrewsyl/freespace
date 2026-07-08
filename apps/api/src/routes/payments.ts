import express from "express";
import { z } from "zod";
import Stripe from "stripe";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { enforceBlockedList, getFraudSettings, getUserRiskProfile, shouldEnforceFraud } from "../middleware/fraud.js";
import { findUserById, findUserByEmail, getBookingByPaymentIntent, insertEventLog } from "../lib/db.js";
import { getOrCreateStripeCustomer } from "../lib/stripe.js";

const router = express.Router();
const paymentMethodLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyPrefix: "payment-methods",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});
const paymentsLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyPrefix: "payments",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});
const retryLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyPrefix: "payments-retry",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

if (!stripeSecret) {
  console.warn("Stripe secret key not set; payments endpoints will return 500.");
}

async function getOrCreateCustomer(user: { id: string; email: string; stripe_customer_id?: string | null }) {
  if (!stripe) throw new Error("Stripe not configured");
  return getOrCreateStripeCustomer(stripe, user);
}

async function requireActiveUser(userId?: string) {
  if (!userId) return { ok: false, message: "Unauthorized" } as const;
  const settings = await getFraudSettings();
  const enforceFraud = shouldEnforceFraud(settings);
  const profile = await getUserRiskProfile(userId);
  if (!profile) return { ok: false, message: "Unauthorized" } as const;
  if (profile.status === "suspended") {
    return { ok: false, message: "Account suspended. Contact support." } as const;
  }
  if (!profile.email_verified) {
    return { ok: false, message: "Please verify your email before adding payments." } as const;
  }
  const accountAgeMinutes = (Date.now() - new Date(profile.created_at).getTime()) / 60000;
  if (accountAgeMinutes < settings.minAccountAgeMinutes) {
    if (!enforceFraud) {
      console.warn("[fraud] payments account age below threshold", {
        userId,
        accountAgeMinutes,
        minAccountAgeMinutes: settings.minAccountAgeMinutes,
      });
      return { ok: true } as const;
    }
    return { ok: false, message: "Please wait a few minutes before adding payments." } as const;
  }
  return { ok: true } as const;
}

router.post("/payment-methods", requireAuth, enforceBlockedList, paymentMethodLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const gate = await requireActiveUser(req.user?.userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const userFromId = await findUserById(req.user!.userId);
    const user = userFromId ?? (req.user?.email ? await findUserByEmail(req.user.email) : undefined);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user);
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        driver_id: req.user!.userId,
        user_email: user.email,
        source: "payment_methods",
      },
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    next(err);
  }
});

router.get("/payment-methods", requireAuth, enforceBlockedList, paymentMethodLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const gate = await requireActiveUser(req.user?.userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const userFromId = await findUserById(req.user!.userId);
    const user = userFromId ?? (req.user?.email ? await findUserByEmail(req.user.email) : undefined);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user);
    const [methods, customer] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: "card" }),
      stripe.customers.retrieve(customerId),
    ]);
    const defaultPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
    res.json({
      paymentMethods: methods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand ?? "",
        last4: pm.card?.last4 ?? "",
        exp_month: pm.card?.exp_month ?? 0,
        exp_year: pm.card?.exp_year ?? 0,
        is_default: pm.id === defaultPm,
        created_at: pm.created ? new Date(pm.created * 1000).toISOString() : undefined,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/payment-methods/:id", requireAuth, enforceBlockedList, paymentMethodLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const gate = await requireActiveUser(req.user?.userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const userFromId = await findUserById(req.user!.userId);
    const user = userFromId ?? (req.user?.email ? await findUserByEmail(req.user.email) : undefined);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user);
    const pmId = z.string().trim().min(5).max(200).parse(req.params.id);
    // A method already attached to a different customer is not this user's to
    // claim as their default.
    const paymentMethod = await stripe.paymentMethods.retrieve(pmId);
    if (paymentMethod.customer && paymentMethod.customer !== customerId) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    if (!paymentMethod.customer) {
      await stripe.paymentMethods.attach(pmId, { customer: customerId });
    }
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/payment-methods/:id", requireAuth, enforceBlockedList, paymentMethodLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const gate = await requireActiveUser(req.user?.userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const pmId = z.string().trim().min(5).max(200).parse(req.params.id);
    // Only detach methods that belong to the caller's own Stripe customer —
    // otherwise any authenticated user who learns a pm_ id could detach it.
    const userFromId = await findUserById(req.user!.userId);
    const user = userFromId ?? (req.user?.email ? await findUserByEmail(req.user.email) : undefined);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user);
    const paymentMethod = await stripe.paymentMethods.retrieve(pmId);
    if (paymentMethod.customer !== customerId) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    await stripe.paymentMethods.detach(pmId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/payments/history", requireAuth, enforceBlockedList, paymentsLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const gate = await requireActiveUser(req.user?.userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const userFromId = await findUserById(req.user!.userId);
    const user = userFromId ?? (req.user?.email ? await findUserByEmail(req.user.email) : undefined);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user);
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 20,
    });
    const payments = paymentIntents.data.map((pi) => {
      const charge = Array.isArray((pi as any).charges?.data) ? (pi as any).charges.data[0] : undefined;
      return {
        id: pi.id,
        booking_id: pi.metadata?.booking_id ?? undefined,
        amount: pi.amount_received || pi.amount,
        currency: pi.currency,
        status: pi.status,
        description: pi.description ?? charge?.description ?? "Payment",
        created_at: new Date(pi.created * 1000).toISOString(),
        receipt_url: charge?.receipt_url,
      };
    });
    res.json({ payments });
  } catch (err) {
    next(err);
  }
});

router.post("/payments/:id/retry", requireAuth, enforceBlockedList, retryLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const gate = await requireActiveUser(req.user?.userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const paymentIntentId = z.string().trim().min(5).max(200).parse(req.params.id);
    const booking = await getBookingByPaymentIntent(paymentIntentId);
    if (!booking) return res.status(404).json({ message: "Payment not found" });
    if (booking.driver_id !== req.user!.userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    if (booking.status === "canceled") {
      return res.status(400).json({ message: "Booking was canceled" });
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status === "succeeded") {
      return res.status(400).json({ message: "Payment already succeeded" });
    }
    if (intent.status === "canceled") {
      return res.status(400).json({ message: "Payment was canceled" });
    }

    if (booking.amount_cents && intent.amount !== booking.amount_cents) {
      await insertEventLog({
        eventType: "payment_mismatch",
        payload: {
          paymentIntentId,
          bookingId: booking.id,
          bookingAmount: booking.amount_cents,
          intentAmount: intent.amount,
          userId: booking.driver_id,
        },
      });
      return res.status(409).json({ message: "Payment amount mismatch" });
    }
    if (booking.currency && intent.currency && booking.currency !== intent.currency) {
      await insertEventLog({
        eventType: "payment_mismatch",
        payload: {
          paymentIntentId,
          bookingId: booking.id,
          bookingCurrency: booking.currency,
          intentCurrency: intent.currency,
          userId: booking.driver_id,
        },
      });
      return res.status(409).json({ message: "Payment currency mismatch" });
    }

    const settings = await getFraudSettings();
    const enforceFraud = shouldEnforceFraud(settings);
    const retryCount = Number(intent.metadata?.retry_count ?? "0") + 1;
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { ...intent.metadata, retry_count: String(retryCount) },
    });
    if (retryCount > 3) {
      await insertEventLog({
        eventType: "payment_retry_limit",
        payload: { paymentIntentId, bookingId: booking.id, userId: booking.driver_id, retryCount },
      });
      if (enforceFraud) {
        return res.status(429).json({ message: "Too many retry attempts. Try again later." });
      }
    }

    await stripe.paymentIntents.confirm(paymentIntentId);
    res.json({ ok: true, retryCount });
  } catch (err) {
    next(err);
  }
});

export default router;
