function normalize(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getDefaultEmailFrom() {
  const configured = normalize(process.env.EMAIL_FROM) ?? normalize(process.env.SMTP_FROM);
  if (!configured || /no-reply@freespace\.ie/i.test(configured)) {
    return "FreeSpace <hello@freespace.ie>";
  }
  return configured;
}

export function getAuthEmailFrom() {
  const configured = normalize(process.env.EMAIL_FROM_SIGNUP) ?? getDefaultEmailFrom();
  if (/no-reply@freespace\.ie/i.test(configured)) {
    return "FreeSpace Accounts <accounts@freespace.ie>";
  }
  return configured;
}

export function getBookingEmailFrom() {
  const configured = normalize(process.env.EMAIL_FROM_BOOKINGS) ?? getDefaultEmailFrom();
  if (/no-reply@freespace\.ie/i.test(configured)) {
    return "FreeSpace Bookings <booking@freespace.ie>";
  }
  return configured;
}

export function getSupportEmailFrom() {
  const configured = normalize(process.env.EMAIL_FROM_SUPPORT) ?? getDefaultEmailFrom();
  if (/no-reply@freespace\.ie/i.test(configured)) {
    return "FreeSpace Support <support@freespace.ie>";
  }
  return configured;
}

export function getSupportEmailInbox() {
  return normalize(process.env.SUPPORT_EMAIL) ?? "support@freespace.ie";
}

export function getSenderAddress(from: string) {
  const match = from.match(/<([^>]+)>/);
  return match?.[1] ?? from;
}
