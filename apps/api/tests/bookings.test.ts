import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.WEB_BASE_URL = "http://localhost:3000";
process.env.STRIPE_SECRET_KEY = "sk_test_1234567890";

const db = {
  createBooking: vi.fn(),
  findUserById: vi.fn(),
  getListingWithHostAccount: vi.fn(),
  getFraudSettings: vi.fn(),
  getRecentBookingStats: vi.fn(),
  getUserRiskProfile: vi.fn(),
  listUserBookings: vi.fn(),
  poolQuery: vi.fn(),
};

const stripeMocks = {
  customersList: vi.fn(),
  customersCreate: vi.fn(),
  ephemeralKeysCreate: vi.fn(),
  paymentIntentsCreate: vi.fn(),
};

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    createBooking: db.createBooking,
    findUserById: db.findUserById,
    getListingWithHostAccount: db.getListingWithHostAccount,
    getFraudSettings: db.getFraudSettings,
    getRecentBookingStats: db.getRecentBookingStats,
    getUserRiskProfile: db.getUserRiskProfile,
    listUserBookings: db.listUserBookings,
    pool: { query: db.poolQuery },
  };
});

vi.mock("../src/lib/stripe.js", () => ({
  stripe: {
    customers: {
      list: stripeMocks.customersList,
      create: stripeMocks.customersCreate,
    },
    ephemeralKeys: {
      create: stripeMocks.ephemeralKeysCreate,
    },
    paymentIntents: {
      create: stripeMocks.paymentIntentsCreate,
    },
  },
  createCheckoutSession: vi.fn(),
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
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    db.createBooking.mockResolvedValue({ id: "booking-1" });
    db.findUserById.mockResolvedValue({ id: "user-1", email: "driver@example.com" });
    db.getListingWithHostAccount.mockResolvedValue({ hostStripeAccountId: null });

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
        amountCents: 1200,
        currency: "eur",
        platformFeePercent: 0.1,
      });

    expect(response.status).toBe(200);
    expect(response.body.paymentIntentId).toBe("pi_123");
    expect(response.body.paymentIntentClientSecret).toBe("pi_123_secret");
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
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getRecentBookingStats.mockResolvedValue({ count: 0, total_cents: 0 });
    db.poolQuery.mockResolvedValue({ rowCount: 1, rows: [{ exists: true }] });

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
        amountCents: 1200,
        currency: "eur",
        platformFeePercent: 0.1,
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Time slot already booked");
  });
});
