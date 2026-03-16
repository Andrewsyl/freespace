import { pool, listAdminSettings, insertEventLog } from "../lib/db.js";

type FraudSettings = {
  mode: "monitor" | "warn" | "enforce";
  manualReview: boolean;
  maxPushTokensPerUser: number;
  maxDevicesPerUser: number;
  blockedIps: string[];
  blockedEmails: string[];
  blockedUserIds: string[];
  maxBookingsPerDay: number;
  maxAmountPerDayCents: number;
  minAccountAgeMinutes: number;
};

const DEFAULT_SETTINGS: FraudSettings = {
  mode: "monitor",
  manualReview: false,
  maxPushTokensPerUser: 6,
  maxDevicesPerUser: 3,
  blockedIps: [],
  blockedEmails: [],
  blockedUserIds: [],
  maxBookingsPerDay: 5,
  maxAmountPerDayCents: 200000,
  minAccountAgeMinutes: 10,
};

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toStringArray = (value: unknown, fallback: string[]) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return fallback;
};

const normalizeEmails = (value: unknown, fallback: string[]) =>
  toStringArray(value, fallback).map((entry) => entry.toLowerCase());

const toBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
};

let cachedSettings: FraudSettings | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;
const geoSeen = new Map<string, { country: string; at: number }>();
const GEO_TTL_MS = 24 * 60 * 60 * 1000;

const getCountryCode = (req: any) => {
  const value =
    req.headers?.["cf-ipcountry"] ||
    req.headers?.["x-vercel-ip-country"] ||
    req.headers?.["x-appengine-country"] ||
    req.headers?.["cloudfront-viewer-country"] ||
    req.headers?.["x-country-code"];
  if (!value || typeof value !== "string") return null;
  const code = value.toUpperCase();
  if (!code || code === "XX") return null;
  return code;
};

const maybeLogGeoMismatch = async (req: any, userId?: string) => {
  if (!userId) return;
  const country = getCountryCode(req);
  if (!country) return;
  const now = Date.now();
  const previous = geoSeen.get(userId);
  if (previous && now - previous.at < GEO_TTL_MS && previous.country !== country) {
    await insertEventLog({
      eventType: "geo_mismatch",
      payload: {
        userId,
        from: previous.country,
        to: country,
        ip: req.ip ?? null,
        path: req.originalUrl ?? req.url ?? null,
      },
    });
  }
  geoSeen.set(userId, { country, at: now });
};

const getClientIp = (req: any) => {
  const forwarded = req.headers?.["x-forwarded-for"] as string | undefined;
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.ip ?? "unknown";
};

export async function getFraudSettings(): Promise<FraudSettings> {
  const now = Date.now();
  if (cachedSettings && now - cachedAt < CACHE_TTL_MS) return cachedSettings;
  const settings = await listAdminSettings();
  const byKey = new Map(settings.map((row: any) => [row.key, row.value]));
  const rawMode = typeof byKey.get("fraud_mode") === "string" ? byKey.get("fraud_mode") : null;
  const mode =
    rawMode === "enforce" || rawMode === "warn" || rawMode === "monitor"
      ? rawMode
      : DEFAULT_SETTINGS.mode;
  const next: FraudSettings = {
    mode,
    manualReview: toBoolean(byKey.get("payments_manual_review"), DEFAULT_SETTINGS.manualReview),
    maxPushTokensPerUser: toNumber(byKey.get("max_push_tokens_per_user"), DEFAULT_SETTINGS.maxPushTokensPerUser),
    maxDevicesPerUser: toNumber(byKey.get("max_devices_per_user"), DEFAULT_SETTINGS.maxDevicesPerUser),
    blockedIps: toStringArray(byKey.get("blocked_ips"), DEFAULT_SETTINGS.blockedIps),
    blockedEmails: normalizeEmails(byKey.get("blocked_emails"), DEFAULT_SETTINGS.blockedEmails),
    blockedUserIds: toStringArray(byKey.get("blocked_user_ids"), DEFAULT_SETTINGS.blockedUserIds),
    maxBookingsPerDay: toNumber(byKey.get("max_bookings_per_day"), DEFAULT_SETTINGS.maxBookingsPerDay),
    maxAmountPerDayCents: toNumber(byKey.get("max_amount_per_day_cents"), DEFAULT_SETTINGS.maxAmountPerDayCents),
    minAccountAgeMinutes: toNumber(byKey.get("min_account_age_minutes"), DEFAULT_SETTINGS.minAccountAgeMinutes),
  };
  cachedSettings = next;
  cachedAt = now;
  return next;
}

export function shouldEnforceFraud(settings: FraudSettings) {
  return settings.mode === "enforce";
}

export async function enforceBlockedList(req: any, res: any, next: any) {
  try {
    const settings = await getFraudSettings();
    const ip = getClientIp(req);
    const path = req.originalUrl ?? req.url ?? "";
    const userId = req.user?.userId;
    const userEmail = typeof req.user?.email === "string" ? req.user.email.toLowerCase() : null;
    const bodyEmail = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : null;

    const logBlocked = async (reason: string, email?: string | null) => {
      try {
        await insertEventLog({
          eventType: "fraud_blocked",
          payload: {
            reason,
            ip,
            path,
            userId: userId ?? null,
            email: email ?? userEmail ?? bodyEmail ?? null,
          },
        });
      } catch {
        // ignore logging failures
      }
    };

    const shouldEnforce = settings.mode === "enforce";

    if (settings.blockedIps.includes(ip)) {
      console.warn("[fraud] blocked ip", { ip, path: req.originalUrl });
      await logBlocked("blocked_ip");
      if (shouldEnforce) return res.status(403).json({ message: "Access blocked." });
      return next();
    }
    if (userId && settings.blockedUserIds.includes(userId)) {
      console.warn("[fraud] blocked user", { userId, ip, path });
      await logBlocked("blocked_user");
      if (shouldEnforce) return res.status(403).json({ message: "Account blocked." });
      return next();
    }
    if (bodyEmail && settings.blockedEmails.includes(bodyEmail)) {
      console.warn("[fraud] blocked email", { email: bodyEmail, ip, path });
      await logBlocked("blocked_email", bodyEmail);
      if (shouldEnforce) return res.status(403).json({ message: "Account blocked." });
      return next();
    }
    if (userEmail && settings.blockedEmails.includes(userEmail)) {
      console.warn("[fraud] blocked email", { email: userEmail, ip, path });
      await logBlocked("blocked_email", userEmail);
      if (shouldEnforce) return res.status(403).json({ message: "Account blocked." });
      return next();
    }
    await maybeLogGeoMismatch(req, userId);
    return next();
  } catch {
    return next();
  }
}

export async function getUserRiskProfile(userId: string) {
  const result = await pool.query(
    `SELECT email_verified, status, created_at FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] as { email_verified: boolean; status: string | null; created_at: string } | undefined;
}

export async function getRecentBookingStats(userId: string) {
  const res = await pool.query(
    `
    SELECT COUNT(*)::int AS count,
           COALESCE(SUM(amount_cents), 0)::int AS total_cents
    FROM bookings
    WHERE driver_id = $1
      AND created_at >= (now() - interval '24 hours')
      AND (status IS NULL OR status <> 'canceled')
    `,
    [userId]
  );
  return res.rows[0] as { count: number; total_cents: number };
}
