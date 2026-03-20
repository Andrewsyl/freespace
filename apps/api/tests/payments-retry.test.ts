import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.WEB_BASE_URL = "http://localhost:3000";
process.env.STRIPE_SECRET_KEY = "sk_test_1234567890";

const db = {
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  getBookingByPaymentIntent: vi.fn(),
  insertEventLog: vi.fn(),
  getFraudSettings: vi.fn(),
  getUserRiskProfile: vi.fn(),
};

const stripeState = {
  retrieve: vi.fn(),
  update: vi.fn(),
  confirm: vi.fn(),
};

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    findUserById: db.findUserById,
    findUserByEmail: db.findUserByEmail,
    getBookingByPaymentIntent: db.getBookingByPaymentIntent,
    insertEventLog: db.insertEventLog,
  };
});

vi.mock("../src/middleware/fraud.js", async () => {
  const actual = await vi.importActual<typeof import("../src/middleware/fraud.js")>(
    "../src/middleware/fraud.js"
  );
  return {
    ...actual,
    enforceBlockedList: (_req: unknown, _res: unknown, next: () => void) => next(),
    getFraudSettings: db.getFraudSettings,
    getUserRiskProfile: db.getUserRiskProfile,
    shouldEnforceFraud: vi.fn(() => true),
  };
});

vi.mock("stripe", () => {
  return {
    default: class StripeMock {
      paymentIntents = {
        retrieve: stripeState.retrieve,
        update: stripeState.update,
        confirm: stripeState.confirm,
      };
      customers = {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        retrieve: vi.fn(),
      };
      setupIntents = { create: vi.fn() };
      paymentMethods = { list: vi.fn(), attach: vi.fn(), detach: vi.fn() };
    },
  };
});

describe("payments retry route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects mismatched retry attempts and logs the event", async () => {
    db.getFraudSettings.mockResolvedValue({ minAccountAgeMinutes: 0 });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.getBookingByPaymentIntent.mockResolvedValue({
      id: "booking-1",
      driver_id: "user-1",
      status: "pending",
      amount_cents: 1200,
      currency: "eur",
    });
    stripeState.retrieve.mockResolvedValue({
      id: "pi_123",
      amount: 1300,
      currency: "eur",
      status: "requires_payment_method",
      metadata: { retry_count: "0" },
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .post("/api/payments/pi_123/retry")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Payment amount mismatch");
    expect(db.insertEventLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment_mismatch",
      })
    );
    expect(stripeState.confirm).not.toHaveBeenCalled();
  });
});
