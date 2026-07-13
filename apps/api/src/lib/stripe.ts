import "../loadEnv.js";
import Stripe from "stripe";
import { setStripeCustomerIdIfAbsent } from "./db.js";

const secret = process.env.STRIPE_SECRET_KEY;
const isProduction = process.env.NODE_ENV === "production";

if (!secret || secret === "sk_test_placeholder" || secret === "sk_test_replace") {
  console.warn("STRIPE_SECRET_KEY not set; using mock Stripe responses for local development.");
}

export const stripe = secret ? new Stripe(secret, { apiVersion: "2024-06-20" as any }) : null;

export type PaymentInput = {
  amount: number;
  currency: string;
  listingId: string;
  hostStripeAccountId?: string | null;
  // Exact fee in cents, computed by the caller (gross − parking). Passing
  // cents instead of a percent keeps min-fee/cap schedules exact — a percent
  // re-derivation here would drift from the verified booking amounts.
  platformFeeCents: number;
  successUrl: string;
  cancelUrl: string;
  driverId?: string | null;
  userEmail?: string | null;
  manualReview?: boolean;
  source?: string;
  idempotencyKey?: string;
};

// Resolves a user's Stripe customer id, persisting it so future calls are a
// single indexed DB read instead of a Stripe API round-trip. Previously every
// caller ran customers.list({email}) on every request; two concurrent
// requests from a user with no customer yet could each see an empty list and
// each create one, leaving duplicate Stripe customers (and saved cards that
// inconsistently appear depending on which customer a later call resolves).
export async function getOrCreateStripeCustomer(
  stripeClient: Stripe,
  user: { id: string; email: string; stripe_customer_id?: string | null }
): Promise<string> {
  if (user.stripe_customer_id) return user.stripe_customer_id;

  // Fall back to an email lookup so accounts that already had a Stripe
  // customer before this column existed don't get a second one minted.
  const existing = await stripeClient.customers.list({ email: user.email, limit: 1 });
  const customerId =
    existing.data.length > 0 ? existing.data[0].id : (await stripeClient.customers.create({ email: user.email })).id;

  const persistedId = await setStripeCustomerIdIfAbsent(user.id, customerId);
  if (persistedId && persistedId !== customerId) {
    // Lost a rare concurrent race to another request for the same user —
    // discard the duplicate customer we just created and use the winner's id.
    await stripeClient.customers.del(customerId).catch(() => {});
    return persistedId;
  }
  return customerId;
}

export async function createCheckoutSession(input: PaymentInput) {
  const {
    amount,
    currency,
    listingId,
    hostStripeAccountId,
    platformFeeCents,
    successUrl,
    cancelUrl,
    driverId,
    userEmail,
    manualReview,
    source,
    idempotencyKey,
  } = input;
  const normalizedCurrency = currency.toLowerCase();
  const feeAmount = platformFeeCents;

  const mockResponse = () => {
    const fakeId = `cs_test_mock_${Date.now()}`;
    return {
      id: fakeId,
      url: successUrl.replace("{CHECKOUT_SESSION_ID}", fakeId),
      payment_intent: `pi_test_mock_${Date.now()}`,
    } as any;
  };

  if (!stripe) {
    if (isProduction) {
      throw new Error("Stripe not configured");
    }
    return mockResponse();
  }

  try {
    const base: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: normalizedCurrency,
            product_data: {
              name: `Parking booking ${listingId}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        listing_id: listingId,
        platform_fee_cents: String(feeAmount),
        host_account_id: hostStripeAccountId ?? "",
        driver_id: driverId ?? "",
        user_email: userEmail ?? "",
        amount_cents: String(amount),
        currency: normalizedCurrency,
        source: source ?? "web",
        manual_review: manualReview ? "true" : "false",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    return await stripe.checkout.sessions.create(
      base,
      idempotencyKey ? { idempotencyKey } : undefined
    );
  } catch (err: any) {
    if (err?.statusCode === 401 || err?.code === "authentication_required" || err?.type === "StripeAuthenticationError") {
      console.warn("Stripe auth failed; returning mock checkout session. Set a valid STRIPE_SECRET_KEY to enable live calls.");
      if (isProduction) throw err;
      return mockResponse();
    }
    throw err;
  }
}
