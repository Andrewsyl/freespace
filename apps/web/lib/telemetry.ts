"use client";

const SESSION_KEY = "fs_web_session_id";

function getApiBase() {
  return typeof window === "undefined" ? process.env.NEXT_PUBLIC_API_BASE ?? "" : "";
}

export function getWebSessionId() {
  if (typeof window === "undefined") return "server";
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `web-${Date.now()}`;
  window.sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

export async function trackEvent(eventType: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    eventType,
    source: "web",
    sessionId: getWebSessionId(),
    properties: {
      path: window.location.pathname,
      ...properties,
    },
  });
  try {
    await fetch(`${getApiBase()}/api/analytics/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
      credentials: "include",
    });
  } catch {
    // Fire-and-forget analytics.
  }
}

export async function reportClientError(payload: {
  name?: string;
  message: string;
  stack?: string;
  isFatal?: boolean;
}) {
  if (typeof window === "undefined") return;
  try {
    await fetch(`${getApiBase()}/api/support/client-error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "web",
        appEnv: process.env.NODE_ENV === "production" ? "production" : "development",
        runtimeUrl: window.location.origin,
        ...payload,
      }),
      keepalive: true,
      credentials: "include",
    });
  } catch {
    // Keep client error reporting fire-and-forget.
  }
}
