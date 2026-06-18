import AsyncStorage from "@react-native-async-storage/async-storage";
import { mobileEnv } from "./env";

const SESSION_KEY = "mobileAnalyticsSessionId";

async function getSessionId() {
  const existing = await AsyncStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(SESSION_KEY, next);
  return next;
}

async function capturePostHog(
  distinctId: string,
  eventType: string,
  properties?: Record<string, unknown>
) {
  if (!mobileEnv.postHogKey) return;
  try {
    await fetch("https://eu.i.posthog.com/capture/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: mobileEnv.postHogKey,
        event: eventType,
        distinct_id: distinctId,
        properties: { $lib: "freespace-mobile", appEnv: mobileEnv.appEnv, ...properties },
      }),
    });
  } catch {
    // Fire-and-forget.
  }
}

let _postHogDistinctId: string | null = null;

export function setPostHogDistinctId(id: string | null) {
  _postHogDistinctId = id;
}

export async function identifyPostHogUser(
  userId: string,
  traits: { email?: string; name?: string | null }
) {
  if (!mobileEnv.postHogKey) return;
  setPostHogDistinctId(userId);
  try {
    await fetch("https://eu.i.posthog.com/capture/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: mobileEnv.postHogKey,
        event: "$identify",
        distinct_id: userId,
        $set: { email: traits.email, name: traits.name },
      }),
    });
  } catch {
    // Fire-and-forget.
  }
}

export async function resetPostHogUser() {
  setPostHogDistinctId(null);
}

export async function trackEvent(eventType: string, properties?: Record<string, unknown>) {
  try {
    const sessionId = await getSessionId();
    const distinctId = _postHogDistinctId ?? sessionId;

    await Promise.all([
      fetch(`${mobileEnv.apiBase}/api/analytics/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          source: "mobile",
          sessionId,
          properties: { appEnv: mobileEnv.appEnv, ...properties },
        }),
      }),
      capturePostHog(distinctId, eventType, properties),
    ]);
  } catch {
    // Fire-and-forget analytics.
  }
}
