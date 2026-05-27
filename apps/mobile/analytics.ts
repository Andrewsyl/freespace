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

export async function trackEvent(eventType: string, properties?: Record<string, unknown>) {
  try {
    const sessionId = await getSessionId();
    await fetch(`${mobileEnv.apiBase}/api/analytics/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType,
        source: "mobile",
        sessionId,
        properties: {
          appEnv: mobileEnv.appEnv,
          ...properties,
        },
      }),
    });
  } catch {
    // Fire-and-forget analytics.
  }
}
