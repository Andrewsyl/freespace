import type { Request, Response, NextFunction } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export function createRateLimiter({ windowMs, max, keyPrefix, keyGenerator }: RateLimitOptions) {
  const hits = new Map<string, RateLimitEntry>();

  // A key's entry is only ever touched again by another request from the same
  // identity, so expired entries otherwise sit in the Map forever — an IP
  // (or a scanner cycling through many) leaks memory for the life of the
  // process. Sweep periodically to bound it. unref() so the timer never
  // keeps the process (or a test run) alive.
  const sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now >= entry.resetAt) hits.delete(key);
    }
  }, Math.max(windowMs, 60_000));
  sweepTimer.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const keyBase = keyGenerator?.(req) ?? req.ip ?? "unknown";
    const key = `${keyPrefix}:${keyBase}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Too many requests. Please try again shortly." });
    }

    entry.count += 1;
    hits.set(key, entry);
    return next();
  };
}
