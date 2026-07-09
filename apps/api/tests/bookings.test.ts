import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.WEB_BASE_URL = "http://localhost:3000";
process.env.STRIPE_SECRET_KEY = "sk_test_1234567890";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_1234567890";

const db = {
  cancelBookingByDriver: vi.fn(),
  cancelBookingWithRefund: vi.fn(),
  createBooking: vi.fn(),
  findUserById: vi.fn(),
  getBookingForExtension: vi.fn(),
  getBookingForRefund: vi.fn(),
  getBookingByPaymentIntent: vi.fn(),
  getBookingNotificationTargets: vi.fn(),
  getBookingNotificationTargetsByPaymentIntent: vi.fn(),
  getListingWithHostAccount: vi.fn(),
  getFraudSettings: vi.fn(),
  getRecentBookingStats: vi.fn(),
  getUserRiskProfile: vi.fn(),
  insertBookingPayment: vi.fn(),
  insertEventLog: vi.fn(),
  listUnrefundedBookingPayments: vi.fn(),
  listUserBookings: vi.fn(),
  markBookingPaymentRefunded: vi.fn(),
  markBookingRefundedByPaymentIntent: vi.fn(),
  poolQuery: vi.fn(),
  updateBookingExtension: vi.fn(),
  updateBookingStatusByPaymentIntent: vi.fn(),
  updateBookingWindow: vi.fn(),
};

const stripeMocks = {
  checkoutSessionsExpire: vi.fn(),
  createCheckoutSession: vi.fn(),
  customersList: vi.fn(),
  customersCreate: vi.fn(),
  ephemeralKeysCreate: vi.fn(),
  paymentIntentsCreate: vi.fn(),
  paymentIntentsRetrieve: vi.fn(),
  refundsCreate: vi.fn(),
  webhooksConstructEvent: vi.fn(),
};

const opsAlerts = {
  reportOperationalAlert: vi.fn(),
};

const email = {
  sendBookingEmail: vi.fn(),
};

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    cancelBookingByDriver: db.cancelBookingByDriver,
    cancelBookingWithRefund: db.cancelBookingWithRefund,
    createBooking: db.createBooking,
    findUserById: db.findUserById,
    getBookingByPaymentIntent: db.getBookingByPaymentIntent,
    getBookingForExtension: db.getBookingForExtension,
    getBookingForRefund: db.getBookingForRefund,
    getBookingNotificationTargets: db.getBookingNotificationTargets,
    getBookingNotificationTargetsByPaymentIntent: db.getBookingNotificationTargetsByPaymentIntent,
    getListingWithHostAccount: db.getListingWithHostAccount,
    getFraudSettings: db.getFraudSettings,
    getRecentBookingStats: db.getRecentBookingStats,
    getUserRiskProfile: db.getUserRiskProfile,
    insertBookingPayment: db.insertBookingPayment,
    insertEventLog: db.insertEventLog,
    listUnrefundedBookingPayments: db.listUnrefundedBookingPayments,
    listUserBookings: db.listUserBookings,
    markBookingPaymentRefunded: db.markBookingPaymentRefunded,
    markBookingRefundedByPaymentIntent: db.markBookingRefundedByPaymentIntent,
    pool: { query: db.poolQuery },
    updateBookingExtension: db.updateBookingExtension,
    updateBookingStatusByPaymentIntent: db.updateBookingStatusByPaymentIntent,
    updateBookingWindow: db.updateBookingWindow,
  };
});

vi.mock("../src/lib/stripe.js", () => ({
  stripe: {
    checkout: {
      sessions: {
        expire: stripeMocks.checkoutSessionsExpire,
      },
    },
    customers: {
      list: stripeMocks.customersList,
      create: stripeMocks.customersCreate,
    },
    ephemeralKeys: {
      create: stripeMocks.ephemeralKeysCreate,
    },
    paymentIntents: {
      create: stripeMocks.paymentIntentsCreate,
      retrieve: stripeMocks.paymentIntentsRetrieve,
    },
    refunds: {
      create: stripeMocks.refundsCreate,
    },
    webhooks: {
      constructEvent: stripeMocks.webhooksConstructEvent,
    },
  },
  createCheckoutSession: stripeMocks.createCheckoutSession,
  // Test double for the shared customer-id resolver: mirrors the real
  // list-then-create fallback so existing tests can keep driving the outcome
  // via stripeMocks.customersList/customersCreate, without depending on the
  // DB-persistence side effect (setStripeCustomerIdIfAbsent) that isn't
  // relevant to these route-level tests.
  getOrCreateStripeCustomer: async (
    _client: unknown,
    user: { email: string; stripe_customer_id?: string | null }
  ) => {
    if (user.stripe_customer_id) return user.stripe_customer_id;
    const existing = await stripeMocks.customersList({ email: user.email, limit: 1 });
    if (existing.data.length > 0) return existing.data[0].id;
    const created = await stripeMocks.customersCreate({ email: user.email });
    return created.id;
  },
}));

vi.mock("../src/lib/opsAlerts.js", () => ({
  reportOperationalAlert: opsAlerts.reportOperationalAlert,
}));

vi.mock("../src/lib/email.js", () => ({
  sendBookingEmail: email.sendBookingEmail,
}));

vi.mock("../src/middleware/fraud.js", async () => {
  const actual = await vi.importActual<typeof import("../src/middleware/fraud.js")>(
    "../src/middleware/fraud.js"
  );
  return {
    ...actual,
    enforceBlockedList: (_req: unknown, _res: unknown, next: () => void) => next(),
    getFraudSettings: db.getFraudSettings,
    getRecentBookingStats: db.getRecentBookingStats,
    getUserRiskProfile: db.getUserRiskProfile,
    shouldEnforceFraud: vi.fn(() => true),
  };
});

describe("bookings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.updateBookingStatusByPaymentIntent.mockResolvedValue(true);
    db.insertBookingPayment.mockResolvedValue(true);
    db.listUnrefundedBookingPayments.mockResolvedValue([]);
    db.markBookingPaymentRefunded.mockResolvedValue(undefined);
  });

  it("creates a payment intent for a valid authenticated booking", async () => {
    db.getFraudSettings.mockResolvedValue({
      minAccountAgeMinutes: 0,
      maxBookingsPerDay: 10,
      maxAmountPerDayCents: 100000,
    });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      phone_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    db.createBooking.mockResolvedValue({ id: "booking-1" });
    db.findUserById.mockResolvedValue({ id: "user-1", email: "driver@example.com" });
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      rateType: "daily",
      pricePerDay: 12,
      pricePerHour: null,
    });

    stripeMocks.customersList.mockResolvedValue({ data: [] });
    stripeMocks.customersCreate.mockResolvedValue({ id: "cus_123" });
    stripeMocks.ephemeralKeysCreate.mockResolvedValue({ secret: "ephkey_123" });
    stripeMocks.paymentIntentsCreate.mockResolvedValue({
      id: "pi_123",
      client_secret: "pi_123_secret",
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/payment-intent")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-20T10:00:00.000Z",
        to: "2026-03-20T12:00:00.000Z",
        amountCents: 324,
        currency: "eur",
        platformFeePercent: 0.1,
      });

    expect(response.status).toBe(200);
    expect(response.body.paymentIntentId).toBe("pi_123");
    expect(response.body.paymentIntentClientSecret).toBe("pi_123_secret");
    expect(stripeMocks.paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 324,
        payment_method_types: ["card"],
      })
    );
  });

  it("caps sub-day pricing at the daily rate when it is cheaper than hourly", async () => {
    db.getFraudSettings.mockResolvedValue({
      minAccountAgeMinutes: 0,
      maxBookingsPerDay: 10,
      maxAmountPerDayCents: 100000,
    });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      phone_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    db.createBooking.mockResolvedValue({ id: "booking-1" });
    db.findUserById.mockResolvedValue({ id: "user-1", email: "driver@example.com" });
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      rateType: "hourly",
      pricePerDay: 18,
      pricePerHour: 2,
    });

    stripeMocks.customersList.mockResolvedValue({ data: [] });
    stripeMocks.customersCreate.mockResolvedValue({ id: "cus_123" });
    stripeMocks.ephemeralKeysCreate.mockResolvedValue({ secret: "ephkey_123" });
    stripeMocks.paymentIntentsCreate.mockResolvedValue({
      id: "pi_123",
      client_secret: "pi_123_secret",
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/payment-intent")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-20T10:00:00.000Z",
        to: "2026-03-20T21:00:00.000Z",
        amountCents: 1944,
        currency: "eur",
        platformFeePercent: 0.1,
      });

    expect(response.status).toBe(200);
    expect(stripeMocks.paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1944 })
    );
  });

  it("prices a monthly payment-intent from the host's monthly rate", async () => {
    db.getFraudSettings.mockResolvedValue({
      minAccountAgeMinutes: 0,
      maxBookingsPerDay: 10,
      maxAmountPerDayCents: 100000,
    });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      phone_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    db.createBooking.mockResolvedValue({ id: "booking-1" });
    db.findUserById.mockResolvedValue({ id: "user-1", email: "driver@example.com" });
    // Monthly-only listing: no hourly rate, a €160/mo rate, and (as the host
    // flow leaves it) a stale default daily rate that must be ignored.
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      rateType: "daily",
      pricePerDay: 12,
      pricePerHour: null,
      pricePerMonth: 160,
    });

    stripeMocks.customersList.mockResolvedValue({ data: [] });
    stripeMocks.customersCreate.mockResolvedValue({ id: "cus_123" });
    stripeMocks.ephemeralKeysCreate.mockResolvedValue({ secret: "ephkey_123" });
    stripeMocks.paymentIntentsCreate.mockResolvedValue({
      id: "pi_m1",
      client_secret: "pi_m1_secret",
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-pm1", email: "driver@example.com", role: "driver" });

    // 160/mo over a 1-month window = 16000c parking + 8% fee = 17280c, rounded
    // to the nearest whole euro for the buyer-facing monthly gross = 17300c.
    const response = await request(app)
      .post("/api/bookings/payment-intent")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-04-01T00:00:00.000Z",
        mode: "monthly",
        amountCents: 17300,
        currency: "eur",
        platformFeePercent: 8 / 108,
      });

    expect(response.status).toBe(200);
    expect(stripeMocks.paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 17300 })
    );
  });

  it("rejects a monthly payment-intent whose amount omits the service fee", async () => {
    db.getFraudSettings.mockResolvedValue({
      minAccountAgeMinutes: 0,
      maxBookingsPerDay: 10,
      maxAmountPerDayCents: 100000,
    });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      phone_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      rateType: "daily",
      pricePerDay: 12,
      pricePerHour: null,
      pricePerMonth: 160,
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-pm2", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/payment-intent")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-04-01T00:00:00.000Z",
        mode: "monthly",
        amountCents: 16000, // missing the 8% fee
        currency: "eur",
        platformFeePercent: 8 / 108,
      });

    expect(response.status).toBe(400);
    expect(stripeMocks.paymentIntentsCreate).not.toHaveBeenCalled();
  });

  it("rejects a monthly payment-intent on a space without a monthly rate", async () => {
    db.getFraudSettings.mockResolvedValue({
      minAccountAgeMinutes: 0,
      maxBookingsPerDay: 10,
      maxAmountPerDayCents: 100000,
    });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      phone_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      rateType: "daily",
      pricePerDay: 12,
      pricePerHour: null,
      pricePerMonth: null,
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-pm3", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/payment-intent")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-04-01T00:00:00.000Z",
        mode: "monthly",
        amountCents: 17280,
        currency: "eur",
        platformFeePercent: 8 / 108,
      });

    expect(response.status).toBe(400);
    expect(stripeMocks.paymentIntentsCreate).not.toHaveBeenCalled();
  });

  it("returns bookings for the authenticated user", async () => {
    db.listUserBookings.mockResolvedValue([{ id: "booking-1" }]);

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .get("/api/bookings/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "booking-1" }]);
    expect(db.listUserBookings).toHaveBeenCalledWith("user-1");
  });

  it("blocks overlapping payment-intent requests", async () => {
    db.getFraudSettings.mockResolvedValue({
      minAccountAgeMinutes: 0,
      maxBookingsPerDay: 10,
      maxAmountPerDayCents: 100000,
    });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      phone_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      rateType: "daily",
      pricePerDay: 12,
      pricePerHour: null,
    });
    db.poolQuery.mockResolvedValue({ rowCount: 1, rows: [{ booked_count: "1", capacity: "1" }] });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/payment-intent")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-20T10:00:00.000Z",
        to: "2026-03-20T12:00:00.000Z",
        amountCents: 324,
        currency: "eur",
        platformFeePercent: 0.1,
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Time slot already booked");
  });

  it("creates a checkout session with a stable idempotency key", async () => {
    db.getFraudSettings.mockResolvedValue({
      minAccountAgeMinutes: 0,
      maxBookingsPerDay: 10,
      maxAmountPerDayCents: 100000,
    });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      phone_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    db.createBooking.mockResolvedValue({ id: "booking-1" });
    db.findUserById.mockResolvedValue({ id: "user-1", email: "driver@example.com" });
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      title: "Test listing",
      rateType: "daily",
      pricePerDay: 12,
      pricePerHour: null,
    });
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_123",
      url: "https://checkout.test/cs_123",
      payment_intent: "pi_123",
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-20T10:00:00.000Z",
        to: "2026-03-20T12:00:00.000Z",
        amountCents: 324,
        currency: "eur",
        platformFeePercent: 0.1,
      });

    expect(response.status).toBe(201);
    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey:
          "checkout:user-1:11111111-1111-4111-8111-111111111111:2026-03-20T10:00:00.000Z:2026-03-20T12:00:00.000Z:324:eur",
      })
    );
  });

  const primeBookingMocks = () => {
    db.getFraudSettings.mockResolvedValue({
      minAccountAgeMinutes: 0,
      maxBookingsPerDay: 10,
      maxAmountPerDayCents: 10000000,
    });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      phone_verified: true,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    db.createBooking.mockResolvedValue({ id: "booking-1" });
    db.findUserById.mockResolvedValue({ id: "user-1", email: "driver@example.com" });
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_m",
      url: "https://checkout.test/cs_m",
      payment_intent: "pi_m",
    });
  };

  it("prices a monthly booking from the host's monthly rate", async () => {
    primeBookingMocks();
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      title: "Monthly listing",
      rateType: "daily",
      pricePerDay: 12,
      pricePerHour: null,
      pricePerMonth: 160,
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-m1", email: "driver@example.com", role: "driver" });

    // 160/mo over a 1-month window = 16000c parking + 8% fee = 17280c, rounded
    // to the nearest whole euro for the buyer-facing monthly gross = 17300c.
    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-04-01T00:00:00.000Z",
        mode: "monthly",
        amountCents: 17300,
        currency: "eur",
        platformFeePercent: 8 / 108,
      });

    expect(response.status).toBe(201);
  });

  it("rejects a monthly booking whose amount does not match the monthly rate", async () => {
    primeBookingMocks();
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      title: "Monthly listing",
      rateType: "daily",
      pricePerDay: 12,
      pricePerHour: null,
      pricePerMonth: 160,
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-m2", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-04-01T00:00:00.000Z",
        mode: "monthly",
        amountCents: 16000, // missing the service fee
        currency: "eur",
        platformFeePercent: 8 / 108,
      });

    expect(response.status).toBe(400);
  });

  it("rejects a monthly booking on a space without a monthly rate", async () => {
    primeBookingMocks();
    db.getListingWithHostAccount.mockResolvedValue({
      hostStripeAccountId: null,
      title: "Daily-only listing",
      rateType: "daily",
      pricePerDay: 12,
      pricePerHour: null,
      pricePerMonth: null,
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-m3", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-04-01T00:00:00.000Z",
        mode: "monthly",
        amountCents: 17280,
        currency: "eur",
        platformFeePercent: 8 / 108,
      });

    expect(response.status).toBe(400);
  });

  it("does not create a second refund when canceling an already-refunded booking", async () => {
    db.getBookingForRefund.mockResolvedValue({
      id: "booking-1",
      status: "confirmed",
      payment_intent_id: "pi_123",
      payout_status: "pending",
      start_time: new Date("2099-03-20T08:00:00.000Z"),
      end_time: new Date("2099-03-20T12:00:00.000Z"),
      refund_status: "succeeded",
      refund_id: "re_123",
    });
    db.cancelBookingWithRefund.mockResolvedValue(true);
    db.getBookingNotificationTargets.mockResolvedValue(null);

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/11111111-1111-4111-8111-111111111111/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, refunded: true });
    expect(stripeMocks.refundsCreate).not.toHaveBeenCalled();
    expect(db.cancelBookingWithRefund).toHaveBeenCalledWith({
      bookingId: "11111111-1111-4111-8111-111111111111",
      driverId: "user-1",
      refundId: "re_123",
    });
  });

  it("refunds orphan payment intents received via webhook", async () => {
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    stripeMocks.webhooksConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
        },
      },
    });
    stripeMocks.refundsCreate.mockResolvedValue({ id: "re_123" });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app)
      .post("/api/bookings/webhook")
      .set("stripe-signature", "sig_test")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ id: "evt_123" }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, orphan: true });
    expect(stripeMocks.refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_123",
      }),
      expect.objectContaining({
        idempotencyKey: "refund:payment_intent.succeeded:orphan:pi_123:pi_123",
      })
    );
    expect(opsAlerts.reportOperationalAlert).toHaveBeenCalled();
  });

  it("returns a clean conflict when confirm is attempted on an already canceled booking", async () => {
    db.updateBookingStatusByPaymentIntent.mockResolvedValue(false);
    db.getBookingByPaymentIntent.mockResolvedValue({
      id: "booking-1",
      driver_id: "user-1",
      amount_cents: 1200,
      currency: "eur",
      status: "canceled",
      refund_status: "succeeded",
      refund_id: "re_123",
      checkout_session_id: "cs_123",
    });
    db.poolQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "booking-1",
            listing_id: "11111111-1111-4111-8111-111111111111",
            driver_id: "user-1",
            start_time: new Date("2026-03-20T10:00:00.000Z"),
            end_time: new Date("2026-03-20T12:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    stripeMocks.paymentIntentsRetrieve.mockResolvedValue({
      status: "succeeded",
      charges: { data: [{ receipt_url: "https://receipt.test/1" }] },
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        paymentIntentId: "pi_123",
        status: "confirmed",
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Booking already canceled");
  });

  it("confirms a booking when payment_intent.succeeded webhook fires for a valid booking", async () => {
    // Call 1: booking lookup by payment_intent_id
    // Call 2: hasBookingOverlap — booked_count 0 < capacity 1 = no conflict
    // Call 3+: getBookingNotificationTargetsByPaymentIntent — empty rows → null → skip notifications
    db.poolQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "booking-1",
            listing_id: "11111111-1111-4111-8111-111111111111",
            start_time: new Date("2026-03-20T10:00:00.000Z"),
            end_time: new Date("2026-03-20T12:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ booked_count: "0", capacity: "1" }] })
      .mockResolvedValue({ rowCount: 0, rows: [] });

    stripeMocks.webhooksConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123" } },
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app)
      .post("/api/bookings/webhook")
      .set("stripe-signature", "sig_test")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ id: "evt_123" }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(db.updateBookingStatusByPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentId: "pi_123", status: "confirmed" })
    );
    expect(db.insertEventLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "booking_confirmed" })
    );
  });

  it("cancels the booking when payment_intent.payment_failed webhook fires", async () => {
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    stripeMocks.webhooksConstructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_456" } },
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app)
      .post("/api/bookings/webhook")
      .set("stripe-signature", "sig_test")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ id: "evt_456" }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(db.updateBookingStatusByPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentId: "pi_456", status: "canceled" })
    );
  });

  it("confirms a booking via the mobile /confirm endpoint", async () => {
    db.poolQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "booking-1",
            listing_id: "11111111-1111-4111-8111-111111111111",
            driver_id: "user-1",
            start_time: new Date("2026-03-20T10:00:00.000Z"),
            end_time: new Date("2026-03-20T12:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ booked_count: "0", capacity: "1" }] })
      .mockResolvedValue({ rowCount: 0, rows: [] });

    stripeMocks.paymentIntentsRetrieve.mockResolvedValue({
      status: "succeeded",
      charges: { data: [{ receipt_url: "https://receipt.test/1" }] },
    });
    db.getBookingByPaymentIntent.mockResolvedValue({
      id: "booking-1",
      driver_id: "user-1",
      status: "pending",
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentIntentId: "pi_123" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(db.updateBookingStatusByPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentId: "pi_123", status: "confirmed" })
    );
  });

  it("cancels a confirmed booking and issues a Stripe refund", async () => {
    db.getBookingForRefund.mockResolvedValue({
      id: "booking-1",
      status: "confirmed",
      payment_intent_id: "pi_123",
      payout_status: "pending",
      start_time: new Date("2099-03-20T08:00:00.000Z"),
      end_time: new Date("2099-03-20T12:00:00.000Z"),
      refund_status: null,
      refund_id: null,
    });
    stripeMocks.refundsCreate.mockResolvedValue({ id: "re_123" });
    db.markBookingRefundedByPaymentIntent.mockResolvedValue(undefined);
    db.cancelBookingWithRefund.mockResolvedValue(true);
    db.getBookingNotificationTargets.mockResolvedValue(null);

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/11111111-1111-4111-8111-111111111111/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, refunded: true });
    expect(stripeMocks.refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_123" }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("pi_123") })
    );
    expect(db.cancelBookingWithRefund).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "11111111-1111-4111-8111-111111111111", refundId: "re_123" })
    );
  });

  it("refunds extension top-up payments when canceling an extended booking", async () => {
    db.getBookingForRefund.mockResolvedValue({
      id: "booking-1",
      status: "confirmed",
      payment_intent_id: "pi_original",
      payout_status: "pending",
      start_time: new Date("2099-03-20T08:00:00.000Z"),
      end_time: new Date("2099-03-20T12:00:00.000Z"),
      refund_status: null,
      refund_id: null,
    });
    db.listUnrefundedBookingPayments.mockResolvedValue([
      {
        id: "bp-1",
        booking_id: "11111111-1111-4111-8111-111111111111",
        payment_intent_id: "pi_extension",
        amount_cents: 500,
        currency: "eur",
        kind: "extension",
        refund_id: null,
        refund_status: null,
      },
    ]);
    stripeMocks.refundsCreate
      .mockResolvedValueOnce({ id: "re_original" })
      .mockResolvedValueOnce({ id: "re_extension" });
    db.markBookingRefundedByPaymentIntent.mockResolvedValue(undefined);
    db.cancelBookingWithRefund.mockResolvedValue(true);
    db.getBookingNotificationTargets.mockResolvedValue(null);

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    // Distinct user so this test doesn't consume user-1's shared in-memory
    // booking rate-limit budget for the suite.
    const token = signToken({ userId: "user-topup", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/11111111-1111-4111-8111-111111111111/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, refunded: true });
    // Both the original charge and the extension top-up must be refunded.
    expect(stripeMocks.refundsCreate).toHaveBeenCalledTimes(2);
    expect(stripeMocks.refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_original" }),
      expect.anything()
    );
    expect(stripeMocks.refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_extension" }),
      expect.anything()
    );
    expect(db.markBookingPaymentRefunded).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentId: "pi_extension", refundId: "re_extension" })
    );
  });

  it("cancels a pending booking without issuing a refund", async () => {
    db.getBookingForRefund.mockResolvedValue({
      id: "booking-1",
      status: "pending",
      payment_intent_id: null,
      payout_status: null,
      start_time: new Date("2099-03-20T08:00:00.000Z"),
      end_time: new Date("2099-03-20T12:00:00.000Z"),
      refund_status: null,
      refund_id: null,
    });
    db.cancelBookingByDriver.mockResolvedValue(true);
    db.getBookingNotificationTargets.mockResolvedValue(null);

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/11111111-1111-4111-8111-111111111111/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, refunded: false });
    expect(stripeMocks.refundsCreate).not.toHaveBeenCalled();
    expect(db.cancelBookingByDriver).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "11111111-1111-4111-8111-111111111111" })
    );
  });

  it("rejects canceling a booking whose window has already ended, without touching Stripe", async () => {
    db.getBookingForRefund.mockResolvedValue({
      id: "booking-1",
      status: "confirmed",
      payment_intent_id: "pi_123",
      payout_status: "pending",
      start_time: new Date("2020-01-01T08:00:00.000Z"),
      end_time: new Date("2020-01-01T12:00:00.000Z"),
      refund_status: null,
      refund_id: null,
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    // Distinct user so this test doesn't consume user-1's shared in-memory
    // booking rate-limit budget for the suite.
    const token = signToken({ userId: "user-ended", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/11111111-1111-4111-8111-111111111111/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(stripeMocks.refundsCreate).not.toHaveBeenCalled();
    expect(db.cancelBookingWithRefund).not.toHaveBeenCalled();
    expect(db.cancelBookingByDriver).not.toHaveBeenCalled();
  });

  it("cancels an in-progress booking (past start_time) without refunding", async () => {
    db.getBookingForRefund.mockResolvedValue({
      id: "booking-1",
      status: "confirmed",
      payment_intent_id: "pi_123",
      payout_status: "pending",
      // Started an hour ago, ends far in the future — mid-stay cancellation.
      start_time: new Date(Date.now() - 60 * 60 * 1000),
      end_time: new Date("2099-03-20T12:00:00.000Z"),
      refund_status: null,
      refund_id: null,
    });
    db.cancelBookingByDriver.mockResolvedValue(true);
    db.getBookingNotificationTargets.mockResolvedValue(null);

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    // Distinct user so this test doesn't consume user-1's shared in-memory
    // booking rate-limit budget for the suite.
    const token = signToken({ userId: "user-inprogress", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/11111111-1111-4111-8111-111111111111/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, refunded: false });
    expect(stripeMocks.refundsCreate).not.toHaveBeenCalled();
    expect(db.cancelBookingByDriver).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "11111111-1111-4111-8111-111111111111" })
    );
  });

  it("cancels within the free-cancellation cutoff without refunding", async () => {
    db.getBookingForRefund.mockResolvedValue({
      id: "booking-1",
      status: "confirmed",
      payment_intent_id: "pi_123",
      payout_status: "pending",
      // Starts in 1h (inside the 4h cutoff), booked 2h ago (grace expired),
      // not checked in — the reported "cancel minutes before start for a full
      // refund" gap. Cancel still releases the space, but no refund.
      start_time: new Date(Date.now() + 60 * 60 * 1000),
      end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      checked_in_at: null,
      refund_status: null,
      refund_id: null,
    });
    db.cancelBookingByDriver.mockResolvedValue(true);
    db.getBookingNotificationTargets.mockResolvedValue(null);

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-cutoff", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/11111111-1111-4111-8111-111111111111/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, refunded: false });
    expect(stripeMocks.refundsCreate).not.toHaveBeenCalled();
    expect(db.cancelBookingWithRefund).not.toHaveBeenCalled();
    expect(db.cancelBookingByDriver).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "11111111-1111-4111-8111-111111111111" })
    );
  });

  it("does not refund a checked-in booking on cancel", async () => {
    db.getBookingForRefund.mockResolvedValue({
      id: "booking-1",
      status: "confirmed",
      payment_intent_id: "pi_123",
      payout_status: "pending",
      // Far-future start (would otherwise refund), but the driver has checked
      // in — claiming the space forecloses the refund.
      start_time: new Date("2099-03-20T08:00:00.000Z"),
      end_time: new Date("2099-03-20T12:00:00.000Z"),
      created_at: new Date("2099-03-19T00:00:00.000Z"),
      checked_in_at: new Date(),
      refund_status: null,
      refund_id: null,
    });
    db.cancelBookingByDriver.mockResolvedValue(true);
    db.getBookingNotificationTargets.mockResolvedValue(null);

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-checkedin", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/11111111-1111-4111-8111-111111111111/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, refunded: false });
    expect(stripeMocks.refundsCreate).not.toHaveBeenCalled();
    expect(db.cancelBookingWithRefund).not.toHaveBeenCalled();
  });

  it("blocks a booking attempt when the daily booking limit is exceeded", async () => {
    db.getFraudSettings.mockResolvedValue({
      minAccountAgeMinutes: 0,
      maxBookingsPerDay: 3,
      maxAmountPerDayCents: 100000,
    });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      phone_verified: true,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 3, total_cents: 0 });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/bookings/payment-intent")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: "11111111-1111-4111-8111-111111111111",
        from: "2026-03-20T10:00:00.000Z",
        to: "2026-03-20T12:00:00.000Z",
        amountCents: 324,
        currency: "eur",
        platformFeePercent: 0.1,
      });

    expect(response.status).toBe(429);
    expect(response.body.message).toBe("Booking limit reached. Try again later.");
  });

  describe("top-up intent replay protection", () => {
    const EXT_BOOKING_ID = "33333333-3333-4333-8333-333333333333";
    const bookingRow = () => ({
      id: EXT_BOOKING_ID,
      listing_id: "44444444-4444-4444-8444-444444444444",
      start_time: new Date("2099-03-20T08:00:00.000Z"),
      end_time: new Date("2099-03-20T12:00:00.000Z"),
      amount_cents: 1080,
      currency: "eur",
      status: "confirmed",
      price_per_day: null,
      price_per_hour: 2,
      rate_type: "hourly",
    });

    const mockActiveDriver = () => {
      db.getFraudSettings.mockResolvedValue({
        minAccountAgeMinutes: 0,
        maxBookingsPerDay: 10,
        maxAmountPerDayCents: 100000,
      });
      db.getUserRiskProfile.mockResolvedValue({
        status: "active",
        email_verified: true,
        phone_verified: true,
        created_at: "2026-03-01T00:00:00.000Z",
      });
    };

    const succeededIntent = (type: "extension" | "change") => ({
      id: "pi_topup",
      status: "succeeded",
      amount: 1000000,
      currency: "eur",
      metadata: { booking_id: EXT_BOOKING_ID, type },
      charges: { data: [{ receipt_url: "https://receipt.example" }] },
    });

    const makeApp = async (userId: string) => {
      const { createApp } = await import("../src/app.js");
      const { signToken } = await import("../src/lib/auth.js");
      return {
        app: createApp(),
        token: signToken({ userId, email: "driver@example.com", role: "driver" }),
      };
    };

    it("rejects an already-consumed intent replayed with a later end time", async () => {
      mockActiveDriver();
      db.getBookingForExtension.mockResolvedValue(bookingRow());
      db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      stripeMocks.paymentIntentsRetrieve.mockResolvedValue(succeededIntent("extension"));
      db.insertBookingPayment.mockResolvedValue(false);

      const { app, token } = await makeApp("user-ext-replay");
      const response = await request(app)
        .post(`/api/bookings/${EXT_BOOKING_ID}/extend-confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          paymentIntentId: "pi_topup",
          newEndTime: "2099-03-20T14:00:00.000Z",
          newTotalCents: 1296,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Payment has already been used");
      expect(db.updateBookingExtension).not.toHaveBeenCalled();
    });

    it("reports success when the webhook consumed the intent and applied the extension", async () => {
      mockActiveDriver();
      // First read: window still old. Second read (after the failed consume):
      // the webhook has applied the requested end time.
      db.getBookingForExtension
        .mockResolvedValueOnce(bookingRow())
        .mockResolvedValueOnce({
          ...bookingRow(),
          end_time: new Date("2099-03-20T14:00:00.000Z"),
          amount_cents: 1296,
        });
      db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      stripeMocks.paymentIntentsRetrieve.mockResolvedValue(succeededIntent("extension"));
      db.insertBookingPayment.mockResolvedValue(false);

      const { app, token } = await makeApp("user-ext-webhook");
      const response = await request(app)
        .post(`/api/bookings/${EXT_BOOKING_ID}/extend-confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          paymentIntentId: "pi_topup",
          newEndTime: "2099-03-20T14:00:00.000Z",
          newTotalCents: 1296,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ ok: true, alreadyApplied: true, newTotalCents: 1296 });
      expect(db.updateBookingExtension).not.toHaveBeenCalled();
    });

    it("consumes the intent before applying the extension window", async () => {
      mockActiveDriver();
      db.getBookingForExtension.mockResolvedValue(bookingRow());
      db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      stripeMocks.paymentIntentsRetrieve.mockResolvedValue(succeededIntent("extension"));
      db.updateBookingExtension.mockResolvedValue({
        end_time: new Date("2099-03-20T14:00:00.000Z"),
        amount_cents: 1296,
      });

      const { app, token } = await makeApp("user-ext-happy");
      const response = await request(app)
        .post(`/api/bookings/${EXT_BOOKING_ID}/extend-confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          paymentIntentId: "pi_topup",
          newEndTime: "2099-03-20T14:00:00.000Z",
          newTotalCents: 1296,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ ok: true, newTotalCents: 1296 });
      expect(db.insertBookingPayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentIntentId: "pi_topup", kind: "extension" })
      );
      // The consume must land before the window moves — that ordering is the
      // whole replay defense.
      expect(db.insertBookingPayment.mock.invocationCallOrder[0]).toBeLessThan(
        db.updateBookingExtension.mock.invocationCallOrder[0]
      );
    });

    it("refunds the consumed top-up when the window update fails", async () => {
      mockActiveDriver();
      db.getBookingForExtension.mockResolvedValue(bookingRow());
      db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      stripeMocks.paymentIntentsRetrieve.mockResolvedValue(succeededIntent("extension"));
      db.updateBookingExtension.mockResolvedValue(null);
      stripeMocks.refundsCreate.mockResolvedValue({ id: "re_topup" });

      const { app, token } = await makeApp("user-ext-refund");
      const response = await request(app)
        .post(`/api/bookings/${EXT_BOOKING_ID}/extend-confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          paymentIntentId: "pi_topup",
          newEndTime: "2099-03-20T14:00:00.000Z",
          newTotalCents: 1296,
        });

      expect(response.status).toBe(400);
      expect(stripeMocks.refundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: "pi_topup" }),
        expect.anything()
      );
      expect(db.markBookingPaymentRefunded).toHaveBeenCalledWith(
        expect.objectContaining({ paymentIntentId: "pi_topup", refundId: "re_topup" })
      );
    });

    it("rejects an already-consumed intent replayed against change-confirm", async () => {
      mockActiveDriver();
      db.getBookingForExtension.mockResolvedValue(bookingRow());
      db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      stripeMocks.paymentIntentsRetrieve.mockResolvedValue(succeededIntent("change"));
      db.insertBookingPayment.mockResolvedValue(false);

      const { app, token } = await makeApp("user-chg-replay");
      const response = await request(app)
        .post(`/api/bookings/${EXT_BOOKING_ID}/change-confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          paymentIntentId: "pi_topup",
          newStartTime: "2099-03-20T09:00:00.000Z",
          newEndTime: "2099-03-20T15:00:00.000Z",
          newTotalCents: 1296,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Payment has already been used");
      expect(db.updateBookingWindow).not.toHaveBeenCalled();
    });
  });
});
