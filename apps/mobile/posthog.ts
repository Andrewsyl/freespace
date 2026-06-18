import PostHog from "posthog-react-native";
import { mobileEnv } from "./env";

let _client: PostHog | null = null;

export function initPostHog() {
  if (!mobileEnv.postHogKey) return;
  _client = new PostHog(mobileEnv.postHogKey, {
    host: "https://eu.i.posthog.com",
  });
}

export function getPostHog(): PostHog | null {
  return _client;
}

export function capturePostHogException(error: Error, extra?: Record<string, string>) {
  _client?.capture("$exception", {
    $exception_message: error.message,
    $exception_type: error.name || "Error",
    $exception_stack_trace_raw: error.stack ?? "",
    ...extra,
  });
}
