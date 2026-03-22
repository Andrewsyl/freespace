const PARKING_LOCALE = "en-IE";
const PARKING_TIME_ZONE = "Europe/Dublin";

export const formatDateLabel = (date: Date) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (checkDate.getTime() === today.getTime()) return "Today";
  if (checkDate.getTime() === tomorrow.getTime()) return "Tomorrow";

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
