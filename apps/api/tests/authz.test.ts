import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.WEB_BASE_URL = "http://localhost:3000";

const db = {
  findUserById: vi.fn(),
  listUsers: vi.fn(),
};

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    findUserById: db.findUserById,
    listUsers: db.listUsers,
  };
});

vi.mock("../src/middleware/fraud.js", () => ({
  enforceBlockedList: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe("authorization guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents non-admin users from accessing admin routes", async () => {
    db.findUserById.mockResolvedValue({ id: "user-1", role: "driver" });

    const { createApp } = await import("../src/app.js");
    const { signToken } = await import("../src/lib/auth.js");
    const app = createApp();
    const token = signToken({ userId: "user-1", email: "driver@example.com", role: "driver" });

    const response = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Admin access required");
    expect(db.listUsers).not.toHaveBeenCalled();
  });
});
