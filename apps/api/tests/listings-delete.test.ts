import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.WEB_BASE_URL = "http://localhost:3000";

const db = {
  getListingHostId: vi.fn(),
  countActiveBookingsForListing: vi.fn(),
  deleteListing: vi.fn(),
};

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    getListingHostId: db.getListingHostId,
    countActiveBookingsForListing: db.countActiveBookingsForListing,
    deleteListing: db.deleteListing,
  };
});

const LISTING_ID = "11111111-1111-1111-1111-111111111111";

async function deleteListingAs(hostUserId: string) {
  const { createApp } = await import("../src/app.js");
  const { signToken } = await import("../src/lib/auth.js");
  const app = createApp();
  const token = signToken({ userId: hostUserId, email: `${hostUserId}@example.com`, role: "host" });
  return request(app).delete(`/api/listings/${LISTING_ID}`).set("Authorization", `Bearer ${token}`);
}

describe("DELETE /api/listings/:id active-booking guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks deletion with 409 while an active booking exists", async () => {
    db.getListingHostId.mockResolvedValue("host-del-1");
    db.countActiveBookingsForListing.mockResolvedValue(2);

    const res = await deleteListingAs("host-del-1");

    expect(res.status).toBe(409);
    expect(res.body.activeBookings).toBe(2);
    expect(res.body.message).toMatch(/2 active bookings/);
    expect(db.deleteListing).not.toHaveBeenCalled();
  });

  it("archives the listing when there are no active bookings", async () => {
    db.getListingHostId.mockResolvedValue("host-del-2");
    db.countActiveBookingsForListing.mockResolvedValue(0);
    db.deleteListing.mockResolvedValue(true);

    const res = await deleteListingAs("host-del-2");

    expect(res.status).toBe(204);
    expect(db.deleteListing).toHaveBeenCalledWith({ listingId: LISTING_ID, hostId: "host-del-2" });
  });

  it("returns 404 (and never checks bookings) when the host doesn't own the listing", async () => {
    db.getListingHostId.mockResolvedValue("some-other-host");

    const res = await deleteListingAs("host-del-3");

    expect(res.status).toBe(404);
    expect(db.countActiveBookingsForListing).not.toHaveBeenCalled();
    expect(db.deleteListing).not.toHaveBeenCalled();
  });
});
