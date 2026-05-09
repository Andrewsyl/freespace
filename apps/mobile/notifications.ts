import { Asset } from "expo-asset";
import type { NotificationContentInput } from "expo-notifications";

export async function getNotificationImageAttachment(): Promise<
  NotificationContentInput["attachments"]
> {
  const asset = Asset.fromModule(require("./assets/car-illustration.png"));
  await asset.downloadAsync();
  const notificationImageUri = asset.localUri ?? asset.uri ?? null;
  if (!notificationImageUri) return [];

  return [{ identifier: "booking_car", url: notificationImageUri, type: "image/png" }];
}
