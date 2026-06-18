import AsyncStorage from "@react-native-async-storage/async-storage";
import { mobileEnv } from "./env";
import { getPostHog } from "./posthog";

const SESSION_KEY = "mobileAnalyticsSessionId";

async function getSessionId() {
  const existing = await AsyncStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(SESSION_KEY, next);
  return next;
}

export async function identifyPostHogUser(
  userId: string,
  traits: { email?: string; name?: string | null }
) {
  const ph = getPostHog();
  if (!ph) return;
  const props: Record<string, string> = {};
  if (traits.email) props.email = traits.email;
  if (traits.name) props.name = traits.name;
  ph.identify(userId, props);
}

export async function resetPostHogUser() {
  getPostHog()?.reset();
}

export async function trackEvent(eventType: string, properties?: Record<string, unknown>) {
  try {
    const sessionId = await getSessionId();

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
      Promise.resolve(
        getPostHog()?.capture(eventType, { $lib: "freespace-mobile", appEnv: mobileEnv.appEnv, ...properties })
      ),
    ]);
  } catch {
    // Fire-and-forget analytics.
  }
}
