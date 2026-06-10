import { Asset } from "expo-asset";
import * as Notifications from "expo-notifications";
import type { NotificationContentInput } from "expo-notifications";

// Deterministic identifiers for booking reminders. Scheduling with the same
// identifier replaces the pending notification, so re-scheduling (e.g. every
// visit to the booking detail screen) can never stack duplicates.
export const bookingReminderIds = {
  start: (listingId: string, startMs: number) => `booking-start-${listingId}-${startMs}`,
  end: (listingId: string, endMs: number) => `booking-end-${listingId}-${endMs}`,
};

export async function cancelBookingReminders(identifiers: string[]) {
  await Promise.all(
    identifiers.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {
        // Cancellation is best-effort; the id may never have been scheduled.
      })
    )
  );
}

export async function getNotificationImageAttachment(): Promise<
  NotificationContentInput["attachments"]
> {
  const asset = Asset.fromModule(require("./assets/car-illustration.png"));
  await asset.downloadAsync();
  const notificationImageUri = asset.localUri ?? asset.uri ?? null;
  if (!notificationImageUri) return [];

  return [{ identifier: "booking_car", url: notificationImageUri, type: "image/png" }];
}
