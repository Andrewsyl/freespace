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
  insertRefreshToken: vi.fn(),
  setEmailVerified: vi.fn(),
  setRefreshToken: vi.fn(),
};

const jose = vi.hoisted(() => ({
  createRemoteJWKSet: vi.fn(() => Symbol("jwks")),
  jwtVerify: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    createRemoteJWKSet: jose.createRemoteJWKSet,
    jwtVerify: jose.jwtVerify,
  };
});

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    createUser: db.createUser,
    findUserByEmail: db.findUserByEmail,
    insertEventLog: db.insertEventLog,
    insertRefreshToken: db.insertRefreshToken,
    setEmailVerified: db.setEmailVerified,
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
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-web-client-id";
    process.env.GOOGLE_IOS_CLIENT_ID = "google-ios-client-id";
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
    db.insertRefreshToken.mockResolvedValueOnce(undefined);

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
    expect(db.insertRefreshToken).toHaveBeenCalled();
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

  it("logs in with a verified Google token", async () => {
    db.findUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      email: "driver@example.com",
      role: "driver",
      full_name: "Driver Example",
      phone: null,
      phone_verified: false,
      email_verified: false,
      terms_version: "2026-03",
      terms_accepted_at: null,
      privacy_version: "2026-03",
      privacy_accepted_at: null,
      status: "active",
    });
    db.setEmailVerified.mockResolvedValueOnce(undefined);
    db.insertRefreshToken.mockResolvedValueOnce(undefined);
    db.insertEventLog.mockResolvedValueOnce(undefined);
    jose.jwtVerify.mockResolvedValueOnce({
      payload: {
        email: "driver@example.com",
        name: "Driver Example",
      },
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/auth/oauth/google").send({
      idToken: "google-id-token-value-1234567890",
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.refreshToken).toBeTruthy();
    expect(response.body.user.email).toBe("driver@example.com");
    expect(db.setEmailVerified).toHaveBeenCalledWith("user-1", true);
    expect(jose.jwtVerify).toHaveBeenCalled();
  });

  it("rejects an invalid Google token", async () => {
    const { errors: joseErrors } = await import("jose");
    jose.jwtVerify.mockRejectedValueOnce(new joseErrors.JWTInvalid("invalid"));

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/auth/oauth/google").send({
      idToken: "google-id-token-value-1234567890",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid Google token");
  });
});
