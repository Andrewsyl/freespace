import { Expo } from "expo-server-sdk";
import {
  listDueScheduledNotifications,
  listPushTokensByUserIds,
  markScheduledNotificationSent,
} from "./db.js";

const expo = new Expo();

type PushPayload = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  // Android notification channel; the app registers "booking-reminders"
  // (high importance) for time-critical reminders. Defaults to "default".
  channelId?: string;
  // Notification category (registered on the client) that adds action buttons,
  // e.g. "booking_ending" → "Extend +".
  categoryId?: string;
};

type PushSendResult = {
  attempted: number;
  ok: number;
  error: number;
};

export async function sendPushNotification({ tokens, title, body, data, channelId, categoryId }: PushPayload) {
  if (!tokens.length) {
    return { attempted: 0, ok: 0, error: 0 } satisfies PushSendResult;
  }

  const messages = tokens
    .filter((token) => Expo.isExpoPushToken(token))
    .map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
      ...(channelId ? { channelId } : {}),
      ...(categoryId ? { categoryId } : {}),
    }));

  if (!messages.length) {
    return { attempted: 0, ok: 0, error: 0 } satisfies PushSendResult;
  }

  try {
    if (process.env.PUSH_LOGGING === "true") {
      console.log(`Push send: ${messages.length} message(s)`);
    }
    const tickets = await expo.sendPushNotificationsAsync(messages);
    let ok = 0;
    let error = 0;
    if (process.env.PUSH_LOGGING === "true") {
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          error += 1;
          console.warn("Push ticket error", ticket.message, ticket.details);
        } else {
          ok += 1;
          console.log("Push ticket ok", ticket.id ?? "no-id");
        }
      }
    } else {
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          error += 1;
        } else {
          ok += 1;
        }
      }
    }
    return { attempted: messages.length, ok, error } satisfies PushSendResult;
  } catch (error) {
    console.warn("Push send failed", error);
    return { attempted: messages.length, ok: 0, error: messages.length } satisfies PushSendResult;
  }
}

export async function processScheduledNotifications(limit = 50) {
  const due = await listDueScheduledNotifications(limit);
  if (process.env.PUSH_LOGGING === "true") {
    console.log(`Push processor: ${due.length} due`);
  }
  if (!due.length) return 0;

  const userIds = Array.from(new Set(due.map((item) => item.user_id)));
  const tokens = await listPushTokensByUserIds(userIds);
  const tokensByUser = new Map<string, string[]>();
  for (const token of tokens) {
    const list = tokensByUser.get(token.user_id) ?? [];
    list.push(token.expo_token);
    tokensByUser.set(token.user_id, list);
  }

  let sent = 0;
  for (const item of due) {
    const userTokens = tokensByUser.get(item.user_id) ?? [];
    let shouldMarkSent = userTokens.length === 0;
    if (userTokens.length) {
      const listingName = item.listing_title?.trim() || "Your parking space";
      const title =
        item.type === "booking_start_soon"
          ? "Booking starts soon"
          : item.type === "booking_end_soon"
            ? "Your parking ends in 30 minutes"
            : "Leave a review";
      const body =
        item.type === "booking_start_soon"
          ? `${listingName} starts in 1 hour.`
          : item.type === "booking_end_soon"
            ? `${listingName} — need more time?`
            : "How was your parking? Leave a quick review.";
      const result = await sendPushNotification({
        tokens: userTokens,
        title,
        body,
        data: {
          bookingId: item.booking_id,
          type: item.type === "booking_end_soon" ? "booking_extend_prompt" : item.type,
          historyTab:
            item.type === "booking_end_soon"
              ? "active"
              : item.type === "booking_start_soon"
                ? "upcoming"
                : "past",
          ...(item.payload ?? {}),
        },
        channelId:
          item.type === "booking_start_soon" || item.type === "booking_end_soon"
            ? "booking-reminders-v2"
            : undefined,
        // "Extend +" action button on the end-soon reminder (category is
        // registered on the client at app startup).
        categoryId: item.type === "booking_end_soon" ? "booking_ending" : undefined,
      });
      shouldMarkSent = result.ok > 0;
      if (!shouldMarkSent && process.env.PUSH_LOGGING === "true") {
        console.warn("Push processor: leaving notification unsent for retry", {
          notificationId: item.id,
          bookingId: item.booking_id,
          type: item.type,
          attempted: result.attempted,
          ok: result.ok,
          error: result.error,
        });
      }
    }
    if (shouldMarkSent) {
      await markScheduledNotificationSent(item.id);
      sent += 1;
    }
  }

  if (process.env.PUSH_LOGGING === "true") {
    console.log(`Push processor: sent ${sent}`);
  }
  return sent;
}
