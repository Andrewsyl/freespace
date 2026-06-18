import { PostHog } from "posthog-node";
import { env } from "../env.js";

let _client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  return _client;
}

export function initPostHog() {
  const key = (process.env.POSTHOG_API_KEY ?? "").trim();
  if (!key) return;
  _client = new PostHog(key, {
    host: "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}

export function captureException(error: unknown, extra?: Record<string, unknown>) {
  const client = _client;
  if (!client) return;
  const err = error instanceof Error ? error : new Error(String(error));
  client.capture({
    distinctId: "server",
    event: "$exception",
    properties: {
      $exception_message: err.message,
      $exception_type: err.name || "Error",
      $exception_stack_trace_raw: err.stack,
      environment: env.NODE_ENV,
      ...extra,
    },
  });
}
