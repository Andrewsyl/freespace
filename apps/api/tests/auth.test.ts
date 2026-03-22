import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.WEB_BASE_URL = "http://localhost:3000";

const db = {
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  insertEventLog: vi.fn(),
  setRefreshToken: vi.fn(),
};

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    createUser: db.createUser,
    findUserByEmail: db.findUserByEmail,
    insertEventLog: db.insertEventLog,
    setRefreshToken: db.setRefreshToken,
  };
});

vi.mock("../src/lib/mailer.js", () => ({
  isMailerConfigured: false,
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/sms.ts", () => ({
  SmsConfigError: class SmsConfigError extends Error {},
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/middleware/fraud.js", () => ({
  enforceBlockedList: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a new user and returns tokens", async () => {
    db.findUserByEmail.mockResolvedValueOnce(null);
    db.createUser.mockResolvedValueOnce({
      id: "user-1",
      email: "driver@example.com",
      role: "driver",
      full_name: null,
      phone: null,
      phone_verified: false,
      email_verified: false,
      terms_version: "2026-03",
      terms_accepted_at: null,
      privacy_version: "2026-03",
      privacy_accepted_at: null,
    });
    db.setRefreshToken.mockResolvedValueOnce(undefined);

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/auth/register").send({
      email: "driver@example.com",
      password: "password123",
      termsVersion: "2026-03",
      privacyVersion: "2026-03",
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy();
    expect(response.body.refreshToken).toBeTruthy();
    expect(response.body.user.email).toBe("driver@example.com");
    expect(db.createUser).toHaveBeenCalled();
    expect(db.setRefreshToken).toHaveBeenCalled();
  });

  it("rejects invalid login credentials", async () => {
    db.findUserByEmail.mockResolvedValueOnce(null);

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/auth/login").send({
      email: "missing@example.com",
      password: "wrong",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });
});
