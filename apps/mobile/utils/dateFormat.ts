const PARKING_LOCALE = "en-IE";
const PARKING_TIME_ZONE = "Europe/Dublin";

// Calendar day (YYYY-MM-DD) for a date as observed in the app's timezone, so
// "Today"/"Tomorrow" line up with the times we render in Europe/Dublin instead
// of the device's local timezone.
const parkingDayKey = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: PARKING_TIME_ZONE });

export const formatDateLabel = (date: Date) => {
  const now = new Date();
  const todayKey = parkingDayKey(now);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowKey = parkingDayKey(tomorrow);
  const checkKey = parkingDayKey(date);

  if (checkKey === todayKey) return "Today";
  if (checkKey === tomorrowKey) return "Tomorrow";

  return date.toLocaleDateString(PARKING_LOCALE, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: PARKING_TIME_ZONE,
  });
};

export const formatTimeLabel = (date: Date) =>
  date.toLocaleTimeString(PARKING_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PARKING_TIME_ZONE,
  });

export const formatDateTimeLabel = (date: Date) =>
  `${formatDateLabel(date)} · ${formatTimeLabel(date)}`;

export const format = (date: Date) =>
  `${formatDateLabel(date)}, ${formatTimeLabel(date)}`;

export const formatReviewDate = (date: Date) =>
  date.toLocaleDateString(PARKING_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: PARKING_TIME_ZONE,
  });
