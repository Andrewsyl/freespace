import { Router } from "express";
import { z } from "zod";
import {
  comparePassword,
  generateRefreshToken,
  generateVerificationToken,
  hashPassword,
  hashToken,
  signToken,
} from "../lib/auth.js";
import {
  clearRefreshToken,
  createUser,
  deleteUserAccount,
  findUserByEmail,
  findUserById,
  findUserByResetToken,
  findUserByRefreshTokenHash,
  setEmailVerified,
  setLegalAcceptance,
  setPasswordResetToken,
  setRefreshToken,
  updateUserProfile,
  type UserRecord,
  setVerificationToken,
  updateUserPassword,
  verifyUserEmail,
  setPhoneVerificationToken,
  verifyUserPhone,
  insertEventLog,
} from "../lib/db.js";
import { isMailerConfigured, sendMail } from "../lib/mailer.js";
import { getAuthEmailFrom, getSenderAddress } from "../lib/emailSenders.js";
import { buildVerificationEmail, buildPasswordResetEmail } from "../lib/emailTemplates.js";
import { sendSms, SmsConfigError } from "../lib/sms.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { enforceBlockedList } from "../middleware/fraud.js";

const router = Router();
const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, keyPrefix: "login" });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "register" });
const resetLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3, keyPrefix: "reset" });
const verifyLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3, keyPrefix: "verify" });
const smsLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3, keyPrefix: "sms" });
const oauthLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10, keyPrefix: "oauth" });
const refreshLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: "refresh" });
const accountWriteLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "account-write",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});
const accountDeleteLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 2,
  keyPrefix: "account-delete",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});


const toPublicUser = (user: UserRecord) => ({
  id: user.id,
  email: user.email,
  name: user.full_name ?? null,
  phone: user.phone ?? null,
  phoneVerified: user.phone_verified ?? false,
  vehicleMake: user.vehicle_make ?? null,
  vehicleType: user.vehicle_type ?? null,
  vehicleColor: user.vehicle_color ?? null,
  vehiclePlate: user.vehicle_plate ?? null,
  status: user.status ?? "active",
  role: user.role,
  emailVerified: user.email_verified ?? false,
  termsVersion: user.terms_version ?? null,
  termsAcceptedAt: user.terms_accepted_at ?? null,
  privacyVersion: user.privacy_version ?? null,
  privacyAcceptedAt: user.privacy_accepted_at ?? null,
});

const ensureAccountActive = (user: Pick<UserRecord, "status">) => user.status !== "suspended";

const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

function normalizePhoneInput(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[\s\-().]/g, "");
  if (!compact) return null;

  const withInternationalPrefix = compact.startsWith("00")
    ? `+${compact.slice(2)}`
    : compact;

  if (E164_PHONE_REGEX.test(withInternationalPrefix)) {
    return withInternationalPrefix;
  }

  if (/^\d+$/.test(withInternationalPrefix)) {
    if (withInternationalPrefix.startsWith("353")) {
      const candidate = `+${withInternationalPrefix}`;
      return E164_PHONE_REGEX.test(candidate) ? candidate : null;
    }
    if (withInternationalPrefix.startsWith("0")) {
      const candidate = `+353${withInternationalPrefix.slice(1)}`;
      return E164_PHONE_REGEX.test(candidate) ? candidate : null;
    }
  }

  return null;
}

const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(6)
    .max(32)
    .transform((value) => normalizePhoneInput(value))
    .refine((value): value is string => Boolean(value), "Enter a valid phone number"),
});

const registerPhoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(32);

const phoneVerifySchema = z.object({
  code: z.string().trim().min(4).max(8),
});

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: registerPhoneSchema.optional(),
  termsVersion: z.string().trim().min(1).max(32),
  privacyVersion: z.string().trim().min(1).max(32),
});

function generateSmsCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPublicApiBaseUrl() {
  return (process.env.PUBLIC_API_BASE_URL ?? "https://api.freespace.ie").replace(/\/$/, "");
}

function buildVerificationUrl(token: string) {
  if (process.env.NODE_ENV !== "production" && !process.env.PUBLIC_API_BASE_URL) {
    return buildVerificationAppUrl(token);
  }
  const webBase = (process.env.WEB_BASE_URL ?? "https://freespace.ie").replace(/\/$/, "");
  return `${webBase}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildVerificationAppUrl(token: string, apiBase = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, "")) {
  const query = new URLSearchParams({
    token,
  });
  if (apiBase) {
    query.set("apiBase", apiBase);
  }
  return `carparking://verify-email?${query.toString()}`;
}

function buildVerificationPreviewUrl(token: string) {
  if (process.env.NODE_ENV === "production" && isMailerConfigured) {
    return undefined;
  }
  return buildVerificationAppUrl(token, process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, ""));
}

function buildPasswordResetUrl(token: string) {
  if (process.env.NODE_ENV !== "production" && !process.env.PUBLIC_API_BASE_URL) {
    return buildPasswordResetAppUrl(token);
  }
  const webBase = (process.env.WEB_BASE_URL ?? "https://freespace.ie").replace(/\/$/, "");
  return `${webBase}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildPasswordResetAppUrl(token: string, apiBase = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, "")) {
  const query = new URLSearchParams({
    token,
  });
  if (apiBase) {
    query.set("apiBase", apiBase);
  }
  return `carparking://reset-password?${query.toString()}`;
}

function buildPasswordResetPreviewUrl(token: string) {
  if (process.env.NODE_ENV === "production" && isMailerConfigured) {
    return undefined;
  }
  return buildPasswordResetAppUrl(token, process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, ""));
}

router.post("/register", enforceBlockedList, registerLimiter, async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, termsVersion, privacyVersion, phone } = registerSchema.parse(req.body);
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }
    const passwordHash = await hashPassword(password);
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    const normalizedFullName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ") || null;
    const normalizedPhone = normalizePhoneInput(phone) ?? phone?.trim() ?? null;
    const e164Phone = normalizePhoneInput(phone);
    const phoneToken = e164Phone ? generateSmsCode() : null;
    const phoneExpires = e164Phone ? new Date(Date.now() + 1000 * 60 * 10) : null; // 10 min
    const user = await createUser({
      email,
      fullName: normalizedFullName,
      phone: normalizedPhone,
      passwordHash,
      verificationToken: token,
      verificationExpires: expires,
      phoneVerificationToken: phoneToken,
      phoneVerificationExpires: phoneExpires,
      termsVersion,
      privacyVersion,
    });
    if (!user) {
      return res.status(500).json({ message: "Could not create user" });
    }
    const jwt = signToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(refreshToken), refreshExpires);
    // Fire and forget email; if email fails we still allow soft login.
    const verifyUrl = buildVerificationUrl(token);
    sendMail({
      to: user.email,
      subject: "Verify your email",
      text: `Click to verify: ${verifyUrl}`,
      html: buildVerificationEmail(verifyUrl),
      from: getAuthEmailFrom(),
    }).catch((err) => console.warn("send verification email failed", err));
    const previewUrl = buildVerificationPreviewUrl(token);
    if (e164Phone && phoneToken) {
      sendSms({
        to: e164Phone,
        message: `Your FreeSpace verification code is ${phoneToken}. It expires in 10 minutes.`,
      }).catch((err) => console.warn("send sms failed", err));
    }
    await insertEventLog({
      eventType: "signup_completed",
      payload: { userId: user.id },
    });
    res.status(201).json({
      token: jwt,
      refreshToken,
      user: toPublicUser(user),
      previewUrl,
    });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

router.post("/login", enforceBlockedList, loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (!ensureAccountActive(user)) {
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(refreshToken), refreshExpires);
    await insertEventLog({
      eventType: "login_succeeded",
      payload: { userId: user.id },
    });
    res.json({
      token,
      refreshToken,
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

const googleOAuthSchema = z.object({
  idToken: z.string().min(20),
});

router.post("/oauth/google", enforceBlockedList, oauthLimiter, async (req, res, next) => {
  try {
    const { idToken } = googleOAuthSchema.parse(req.body);
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!response.ok) {
      return res.status(401).json({ message: "Invalid Google token" });
    }
    const payload = (await response.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string;
      name?: string;
    };
    if (!payload.email) {
      return res.status(400).json({ message: "Google account missing email" });
    }
    const acceptedAudiences = [
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter((value): value is string => Boolean(value));
    if (acceptedAudiences.length > 0 && (!payload.aud || !acceptedAudiences.includes(payload.aud))) {
      return res.status(401).json({ message: "Invalid Google token audience" });
    }
    let user = await findUserByEmail(payload.email);
    if (!user) {
      const passwordHash = await hashPassword(generateVerificationToken());
      user = await createUser({
        email: payload.email,
        fullName: payload.name?.trim() || null,
        passwordHash,
        verificationToken: null,
        verificationExpires: null,
      });
    } else if (payload.name && !user.full_name) {
      user =
        (await updateUserProfile({
          userId: user.id,
          fullName: payload.name.trim(),
        })) ?? user;
    }
    if (!user) {
      return res.status(500).json({ message: "Could not create user" });
    }
    if (!ensureAccountActive(user)) {
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }
    await setEmailVerified(user.id, true);
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(refreshToken), refreshExpires);
    await insertEventLog({
      eventType: "login_succeeded",
      payload: { userId: user.id, provider: "google" },
    });
    res.json({
      token,
      refreshToken,
      user: {
        ...toPublicUser(user),
        emailVerified: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

const facebookOAuthSchema = z.object({
  accessToken: z.string().min(20),
});

router.post("/oauth/facebook", enforceBlockedList, oauthLimiter, async (req, res, next) => {
  try {
    const { accessToken } = facebookOAuthSchema.parse(req.body);
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      return res.status(500).json({ message: "Facebook OAuth not configured" });
    }
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
      accessToken
    )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;
    const debugRes = await fetch(debugUrl);
    if (!debugRes.ok) {
      return res.status(401).json({ message: "Invalid Facebook token" });
    }
    const debugPayload = (await debugRes.json()) as {
      data?: { is_valid?: boolean; app_id?: string };
    };
    if (!debugPayload.data?.is_valid || debugPayload.data?.app_id !== appId) {
      return res.status(401).json({ message: "Invalid Facebook token" });
    }
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    if (!meRes.ok) {
      return res.status(401).json({ message: "Facebook profile lookup failed" });
    }
    const me = (await meRes.json()) as { email?: string; name?: string };
    if (!me.email) {
      return res.status(400).json({ message: "Facebook account missing email" });
    }
    let user = await findUserByEmail(me.email);
    if (!user) {
      const passwordHash = await hashPassword(generateVerificationToken());
      user = await createUser({
        email: me.email,
        fullName: me.name?.trim() || null,
        passwordHash,
        verificationToken: null,
        verificationExpires: null,
      });
    } else if (me.name && !user.full_name) {
      user =
        (await updateUserProfile({
          userId: user.id,
          fullName: me.name.trim(),
        })) ?? user;
    }
    if (!user) {
      return res.status(500).json({ message: "Could not create user" });
    }
    if (!ensureAccountActive(user)) {
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }
    await setEmailVerified(user.id, true);
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(refreshToken), refreshExpires);
    await insertEventLog({
      eventType: "login_succeeded",
      payload: { userId: user.id, provider: "facebook" },
    });
    res.json({
      token,
      refreshToken,
      user: {
        ...toPublicUser(user),
        emailVerified: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/verify", async (req, res, next) => {
  try {
    const token = z.string().parse(req.query.token);
    const verified = await verifyUserEmail(token);
    const wantsHtml = (req.get("accept") ?? "").includes("text/html");
    if (!verified) {
      if (wantsHtml) {
        return res.status(400).type("html").send(buildVerificationResultPage({
          title: "Verification link expired",
          body: "This verification link is invalid or has expired. Return to the app and request a new verification email.",
        }));
      }
      return res.status(400).json({ message: "Invalid or expired verification link" });
    }
    await insertEventLog({
      eventType: "email_verified",
      payload: { userId: verified.id },
    });
    if (wantsHtml) {
      return res.type("html").send(buildVerificationResultPage({
        title: "Email verified",
        body: "Your FreeSpace email is now verified. You can return to the app and continue.",
      }));
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/verify-email", async (req, res, next) => {
  try {
    const token = z.string().parse(req.query.token);
    const openAppUrl = buildVerificationAppUrl(token);
    const fallbackUrl = `${getPublicApiBaseUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`;
    res.type("html").send(
      buildVerificationLaunchPage({
        openAppUrl,
        fallbackUrl,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post("/request-verification", enforceBlockedList, verifyLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await setVerificationToken(user.id, token, expires);
    const verifyUrl = buildVerificationUrl(token);
    let sent = true;
    try {
      await sendMail({
        to: user.email,
        subject: "Verify your email",
        text: `Click to verify: ${verifyUrl}`,
        html: buildVerificationEmail(verifyUrl),
        from: getAuthEmailFrom(),
      });
    } catch (err) {
      sent = false;
      console.warn("send verification email failed", err);
    }
    const previewUrl = buildVerificationPreviewUrl(token);
    res.json({ ok: sent, previewUrl });
  } catch (error) {
    next(error);
  }
});

router.post("/request-phone-verification", requireAuth, enforceBlockedList, smsLimiter, async (req, res, next) => {
  try {
    const { phone } = phoneSchema.parse(req.body);
    const userId = req.user!.userId;
    await updateUserProfile({ userId, phone });
    const code = generateSmsCode();
    const expires = new Date(Date.now() + 1000 * 60 * 10);
    await setPhoneVerificationToken(userId, code, expires);
    await sendSms({
      to: phone,
      message: `Your FreeSpace verification code is ${code}. It expires in 10 minutes.`,
    });
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof SmsConfigError) {
      return res.status(503).json({ message: error.message });
    }
    next(error);
  }
});

router.post("/verify-phone", requireAuth, enforceBlockedList, smsLimiter, async (req, res, next) => {
  try {
    const { code } = phoneVerifySchema.parse(req.body);
    const userId = req.user!.userId;
    const updated = await verifyUserPhone(userId, code);
    if (!updated) return res.status(400).json({ message: "Invalid or expired code" });
    res.json({ ok: true, user: toPublicUser(updated as UserRecord) });
  } catch (error) {
    next(error);
  }
});

router.post("/request-password-reset", enforceBlockedList, resetLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    const user = await findUserByEmail(email);
    if (user) {
      const token = generateVerificationToken();
      const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h
      await setPasswordResetToken(user.id, token, expires);
      const resetUrl = buildPasswordResetUrl(token);
      let sent = true;
      try {
        await sendMail({
          to: user.email,
          subject: "Reset your password",
          text: `Reset your password: ${resetUrl}`,
          html: buildPasswordResetEmail(resetUrl),
          from: getAuthEmailFrom(),
        });
      } catch (err) {
        sent = false;
        console.warn("send reset email failed", err);
      }
      const previewUrl = buildPasswordResetPreviewUrl(token);
      return res.json({ ok: sent, previewUrl });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/reset-password", async (req, res, next) => {
  try {
    const token = z.string().parse(req.query.token);
    const openAppUrl = buildPasswordResetAppUrl(token);
    const fallbackUrl = buildPasswordResetAppUrl(token);
    res.type("html").send(
      buildVerificationLaunchPage({
        openAppUrl,
        fallbackUrl,
        eyebrow: "FreeSpace security",
        title: "Open FreeSpace to reset your password",
        body: "We’ll open the app so you can securely choose a new password. If the app does not open, try again from this page on your phone.",
        primaryLabel: "Open FreeSpace",
        secondaryLabel: "Try again",
        steps: [
          "FreeSpace opens on your phone.",
          "Choose a new password securely.",
          "Return to sign in with your new password.",
        ],
        footer: "If nothing happens, return to your email and reopen this link on the same device.",
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", enforceBlockedList, resetLimiter, async (req, res, next) => {
  try {
    const { token, password } = z
      .object({
        token: z.string().trim().min(10).max(256),
        password: z.string().min(6).max(128),
      })
      .parse(req.body);
    const user = await findUserByResetToken(token);
    if (!user) return res.status(400).json({ message: "Invalid or expired reset link" });
    const passwordHash = await hashPassword(password);
    await updateUserPassword(user.id, passwordHash);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", requireAuth, accountWriteLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { currentPassword, newPassword } = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(6).max(128),
      })
      .parse(req.body);
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!ensureAccountActive(user)) {
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }
    const valid = await comparePassword(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    const passwordHash = await hashPassword(newPassword);
    await updateUserPassword(user.id, passwordHash);
    await clearRefreshToken(user.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", refreshLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    const tokenHash = hashToken(refreshToken);
    const user = await findUserByRefreshTokenHash(tokenHash);
    if (!user) return res.status(401).json({ message: "Invalid refresh token" });
    if (!ensureAccountActive(user)) {
      await clearRefreshToken(user.id);
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const nextRefreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(nextRefreshToken), refreshExpires);
    res.json({
      token,
      refreshToken: nextRefreshToken,
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/legal", requireAuth, accountWriteLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { termsVersion, privacyVersion } = z
      .object({
        termsVersion: z.string().trim().min(1).max(32).optional(),
        privacyVersion: z.string().trim().min(1).max(32).optional(),
      })
      .parse(req.body);
    const user = await setLegalAcceptance({
      userId,
      termsVersion: termsVersion ?? null,
      privacyVersion: privacyVersion ?? null,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!ensureAccountActive(user)) {
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.put("/me", requireAuth, accountWriteLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const existingUser = await findUserById(userId);
    if (!existingUser) return res.status(404).json({ message: "User not found" });
    const payload = z
      .object({
        email: z.string().trim().email().nullable().optional(),
        name: z.string().trim().min(1).max(120).nullable().optional(),
        phone: z.string().trim().min(6).max(32).nullable().optional(),
        vehicleMake: z.string().trim().min(1).max(80).nullable().optional(),
        vehicleType: z.string().trim().min(1).max(80).nullable().optional(),
        vehicleColor: z.string().trim().min(1).max(40).nullable().optional(),
        vehiclePlate: z
          .string()
          .trim()
          .min(2)
          .max(12)
          .regex(/^[A-Za-z0-9 \-]+$/, "Only letters, numbers, spaces, and dashes")
          .nullable()
          .optional(),
      })
      .parse(req.body);
    const normalizedEmail = payload.email === undefined ? undefined : payload.email?.toLowerCase() ?? null;
    if (normalizedEmail && normalizedEmail !== existingUser.email) {
      const existingEmail = await findUserByEmail(normalizedEmail);
      if (existingEmail && existingEmail.id !== userId) {
        return res.status(409).json({ message: "Email already registered" });
      }
    }
    const user = await updateUserProfile({
      userId,
      email: normalizedEmail,
      fullName: payload.name,
      phone: payload.phone ? normalizePhoneInput(payload.phone) ?? payload.phone.trim() : payload.phone,
      vehicleMake: payload.vehicleMake,
      vehicleType: payload.vehicleType,
      vehicleColor: payload.vehicleColor,
      vehiclePlate: payload.vehiclePlate ? payload.vehiclePlate.toUpperCase() : payload.vehiclePlate,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    let previewUrl: string | undefined;
    if (normalizedEmail && normalizedEmail !== existingUser.email) {
      const token = generateVerificationToken();
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
      await setVerificationToken(user.id, hashToken(token), expires);
      const verifyUrl = buildVerificationUrl(token);
      try {
        await sendMail({
          to: user.email,
          subject: "Verify your email",
          text: `Click to verify: ${verifyUrl}`,
          html: buildVerificationEmail(verifyUrl),
          from: getAuthEmailFrom(),
        });
        previewUrl = buildVerificationPreviewUrl(token);
      } catch (err) {
        console.warn("send verification email failed", err);
      }
    }
    res.json({ user: toPublicUser(user), previewUrl });
  } catch (error) {
    next(error);
  }
});

router.post("/logout-all", requireAuth, accountWriteLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await clearRefreshToken(userId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, accountWriteLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await clearRefreshToken(userId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Delete current account and related data (bookings, listings). Auth required.
router.delete("/me", requireAuth, accountDeleteLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const deleted = await deleteUserAccount(userId);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

function buildVerificationResultPage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
    </head>
    <body style="margin:0; padding:32px 16px; background:#f4f7fb; font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0f172a;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #dbe4ee; border-radius:24px; box-shadow:0 18px 45px rgba(15, 23, 42, 0.08); overflow:hidden;">
        <div style="padding:28px; background:linear-gradient(135deg, #eff6ff 0%, #ffffff 58%, #f8fafc 100%); border-bottom:1px solid #e2e8f0;">
          <div style="font-size:12px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#1d4ed8;">FreeSpace account</div>
          <h1 style="margin:10px 0 0; font-size:28px; line-height:1.2; font-weight:800; color:#0f172a;">${title}</h1>
        </div>
        <div style="padding:24px 28px 28px;">
          <p style="margin:0; font-size:15px; line-height:1.7; color:#334155;">${body}</p>
        </div>
      </div>
    </body>
  </html>
  `;
}

function buildVerificationLaunchPage({
  openAppUrl,
  fallbackUrl,
  eyebrow = "FreeSpace account",
  title = "Open FreeSpace to finish verification",
  body = "We’ll open the FreeSpace app and complete your email verification there. If the app does not open, you can finish verification in your browser.",
  primaryLabel = "Open FreeSpace",
  secondaryLabel = "Verify in browser",
  steps = [
    "FreeSpace opens on your phone.",
    "Your email is verified securely.",
    "You return to your account and keep going.",
  ],
  footer = "If nothing happens, use the button above or continue in your browser.",
}: {
  openAppUrl: string;
  fallbackUrl: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  steps?: string[];
  footer?: string;
}) {
  const brandBase = process.env.WEB_BASE_URL?.replace(/\/$/, "") ?? "https://freespace.ie";
  const logoUrl = `${brandBase}/freespace-logo.png`;
  const stepsMarkup = steps
    .map((step, index) => `${index + 1}. ${step}<br/>`)
    .join("");
  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Open FreeSpace</title>
    </head>
    <body style="margin:0; padding:32px 16px; background:#f4f7fb; font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0f172a;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #dbe4ee; border-radius:24px; box-shadow:0 18px 45px rgba(15, 23, 42, 0.08); overflow:hidden;">
        <div style="padding:28px; background:linear-gradient(135deg, #eff6ff 0%, #ffffff 58%, #f8fafc 100%); border-bottom:1px solid #e2e8f0;">
          <img src="${logoUrl}" alt="FreeSpace" width="132" height="34" style="display:block; width:132px; height:auto; margin:0 0 16px;" />
          <div style="font-size:12px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#1d4ed8;">${eyebrow}</div>
          <h1 style="margin:10px 0 0; font-size:28px; line-height:1.2; font-weight:800; color:#0f172a;">${title}</h1>
        </div>
        <div style="padding:24px 28px 28px;">
          <p style="margin:0 0 22px; font-size:15px; line-height:1.7; color:#334155;">${body}</p>
          <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:20px;">
            <a href="${openAppUrl}" style="display:inline-block; padding:14px 20px; background:#0f172a; color:#ffffff; border-radius:14px; text-decoration:none; font-size:15px; font-weight:700;">${primaryLabel}</a>
            <a href="${fallbackUrl}" style="display:inline-block; padding:14px 20px; background:#ffffff; color:#0f172a; border:1px solid #dbe4ee; border-radius:14px; text-decoration:none; font-size:15px; font-weight:700;">${secondaryLabel}</a>
          </div>
          <div style="padding:16px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
            <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:10px;">What happens next</div>
            <div style="font-size:14px; line-height:1.7; color:#475569;">
              ${stepsMarkup}
            </div>
          </div>
          <p style="margin:18px 0 0; font-size:13px; line-height:1.6; color:#64748b;">${footer}</p>
        </div>
      </div>
      <script>
        window.setTimeout(function () {
          window.location.replace(${JSON.stringify(openAppUrl)});
        }, 200);
      </script>
    </body>
  </html>
  `;
}
