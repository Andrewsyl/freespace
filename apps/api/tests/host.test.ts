import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.WEB_BASE_URL = "http://localhost:3000";
process.env.STRIPE_SECRET_KEY = "sk_test_1234567890";
process.env.STRIPE_CONNECT_ENABLED = "true";

const db = {
  findUserById: vi.fn(),
  setHostStripeAccountId: vi.fn(),
  getHostEarningsSummary: vi.fn(),
  listDuePayoutsForHost: vi.fn(),
  markPayoutProcessing: vi.fn(),
  markPayoutTransferred: vi.fn(),
  markPayoutPending: vi.fn(),
  getFraudSettings: vi.fn(),
  getUserRiskProfile: vi.fn(),
};

const stripeMocks = {
  accountsCreate: vi.fn(),
  accountsRetrieve: vi.fn(),
  accountLinksCreate: vi.fn(),
  transfersCreate: vi.fn(),
};

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    findUserById: db.findUserById,
    setHostStripeAccountId: db.setHostStripeAccountId,
    getHostEarningsSummary: db.getHostEarningsSummary,
    listDuePayoutsForHost: db.listDuePayoutsForHost,
    markPayoutProcessing: db.markPayoutProcessing,
    markPayoutTransferred: db.markPayoutTransferred,
    markPayoutPending: db.markPayoutPending,
  };
});

vi.mock("../src/lib/stripe.js", () => ({
  stripe: {
    accounts: {
      create: stripeMocks.accountsCreate,
      retrieve: stripeMocks.accountsRetrieve,
    },
    accountLinks: {
      create: stripeMocks.accountLinksCreate,
    },
    transfers: {
      create: stripeMocks.transfersCreate,
    },
  },
}));

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

describe("host payout routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getFraudSettings.mockResolvedValue({ minAccountAgeMinutes: 0 });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
  });

  it("creates a Stripe Connect account and onboarding link", async () => {
    db.findUserById.mockResolvedValue({ id: "host-1", host_stripe_account_id: null });
    db.setHostStripeAccountId.mockResolvedValue(true);
    stripeMocks.accountsCreate.mockResolvedValue({ id: "acct_123" });
    stripeMocks.accountLinksCreate.mockResolvedValue({ url: "https://connect.test/onboarding" });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "host-1", email: "host@example.com", role: "host" });

    const response = await request(app)
      .post("/api/host/payout")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accountId: "acct_123",
      onboardingUrl: "https://connect.test/onboarding",
      mock: false,
    });
    expect(stripeMocks.accountsCreate).toHaveBeenCalledWith({
      type: "express",
      business_type: "individual",
      business_profile: {
        mcc: "7523",
        url: "http://localhost:3000",
      },
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
    expect(db.setHostStripeAccountId).toHaveBeenCalledWith("host-1", "acct_123");
    expect(stripeMocks.accountLinksCreate).toHaveBeenCalledWith({
      account: "acct_123",
      refresh_url: "http://localhost:3000/host/dashboard",
      return_url: "http://localhost:3000/host/dashboard",
      type: "account_onboarding",
    });
  });

  it("returns live payout status for an existing host Stripe account", async () => {
    db.findUserById.mockResolvedValue({ id: "host-1", host_stripe_account_id: "acct_123" });
    stripeMocks.accountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
      requirements: {
        currently_due: ["external_account"],
      },
    });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "host-1", email: "host@example.com", role: "host" });

    const response = await request(app)
      .get("/api/host/payout")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accountId: "acct_123",
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
      requirementsDue: ["external_account"],
    });
  });

  it("runs due payouts and only transfers positive net amounts", async () => {
    db.findUserById.mockResolvedValue({ id: "host-1", host_stripe_account_id: "acct_123" });
    db.listDuePayoutsForHost.mockResolvedValue([
      {
        id: "booking-1",
        amount_cents: 1500,
        fee_cents: 150,
        currency: "eur",
      },
      {
        id: "booking-2",
        amount_cents: 100,
        fee_cents: 100,
        currency: "eur",
      },
    ]);
    db.markPayoutProcessing.mockResolvedValue(true);
    db.markPayoutTransferred.mockResolvedValue(true);
    db.markPayoutPending.mockResolvedValue(true);
    stripeMocks.transfersCreate.mockResolvedValue({ id: "tr_123" });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "host-1", email: "host@example.com", role: "host" });

    const response = await request(app)
      .post("/api/host/payouts/run")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ processed: 1 });
    expect(stripeMocks.transfersCreate).toHaveBeenCalledTimes(1);
    expect(stripeMocks.transfersCreate).toHaveBeenCalledWith({
      amount: 1350,
      currency: "eur",
      destination: "acct_123",
      metadata: { booking_id: "booking-1" },
    });
    expect(db.markPayoutTransferred).toHaveBeenCalledWith({
      bookingId: "booking-1",
      transferId: "tr_123",
    });
    expect(db.markPayoutPending).toHaveBeenCalledWith("booking-2");
  });
});
