import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.WEB_BASE_URL = "http://localhost:3000";

const db = {
  createListing: vi.fn(),
  findUserById: vi.fn(),
  insertEventLog: vi.fn(),
  getFraudSettings: vi.fn(),
  getUserRiskProfile: vi.fn(),
};

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    createListing: db.createListing,
    findUserById: db.findUserById,
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

// A full, valid create payload; individual tests override vehicleSizeSuitability.
const basePayload = {
  title: "Sunny driveway",
  address: "12 Test Street, Dublin",
  pricePerDay: 12,
  availabilityText: "Mon - Sun, 24 hours",
  latitude: 53.35,
  longitude: -6.26,
  permissionDeclared: true,
  description: "A tidy off-street space close to the city centre.",
};

async function postListingAs(hostUserId: string, body: Record<string, unknown>) {
  const { createApp } = await import("../src/app.js");
  const { signToken } = await import("../src/lib/auth.js");
  const app = createApp();
  const token = signToken({ userId: hostUserId, email: `${hostUserId}@example.com`, role: "host" });
  return request(app).post("/api/listings").set("Authorization", `Bearer ${token}`).send(body);
}

describe("POST /api/listings vehicle-size persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getFraudSettings.mockResolvedValue({ minAccountAgeMinutes: 0 });
    db.getUserRiskProfile.mockResolvedValue({
      status: "active",
      email_verified: true,
      created_at: "2026-03-01T00:00:00.000Z",
    });
    db.findUserById.mockResolvedValue({ id: "host-1", host_stripe_account_id: "acct_test" });
    db.insertEventLog.mockResolvedValue(undefined);
    db.createListing.mockResolvedValue({ id: "listing-created-1" });
  });

  it("passes vehicleSizeSuitability through to the db create call", async () => {
    const res = await postListingAs("host-1", { ...basePayload, vehicleSizeSuitability: "large" });

    expect(res.status).toBe(201);
    expect(db.createListing).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleSizeSuitability: "large" })
    );
  });

  it("rejects an invalid vehicleSizeSuitability with 422", async () => {
    const res = await postListingAs("host-1", { ...basePayload, vehicleSizeSuitability: "huge" });

    expect(res.status).toBe(422);
    expect(db.createListing).not.toHaveBeenCalled();
  });
});
