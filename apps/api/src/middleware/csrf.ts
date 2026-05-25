import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function expandAllowedOrigins(values: Array<string | undefined>) {
  const origins = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const rawOrigin of value.split(",")) {
      const origin = rawOrigin.trim();
      if (!origin) continue;
      origins.add(origin);
      try {
        const url = new URL(origin);
        if (url.hostname.startsWith("www.")) {
          url.hostname = url.hostname.slice(4);
        } else {
          url.hostname = `www.${url.hostname}`;
        }
        origins.add(url.origin);
      } catch {
        // Ignore malformed override entries and keep the original value only.
      }
    }
  }
  return origins;
}

function parseCookies(cookieHeader: string | undefined) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return;
    cookies[rawKey] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function isOriginAllowed(origin: string | undefined, allowedOrigins: Set<string>) {
  if (!origin) return true;
  return allowedOrigins.has(origin);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  const enforce =
    process.env.CSRF_PROTECT === "true" ||
    (process.env.NODE_ENV === "production" && process.env.CSRF_PROTECT !== "false");
  if (!enforce) return next();

  const allowedOrigins = expandAllowedOrigins([process.env.WEB_BASE_URL, process.env.CSRF_ALLOWED_ORIGINS]);

  if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
    return res.status(403).json({ message: "CSRF blocked (origin)" });
  }

  const cookies = parseCookies(req.headers.cookie);
  if (!cookies.csrf_token) return next(); // No cookie auth in use.

  const headerToken = req.headers["x-csrf-token"] || req.headers["x-csrf"];
  if (!headerToken || headerToken !== cookies.csrf_token) {
    return res.status(403).json({ message: "CSRF blocked (token)" });
  }

  return next();
}
