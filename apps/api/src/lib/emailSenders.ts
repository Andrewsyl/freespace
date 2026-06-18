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
    return "FreeSpace <accounts@freespace.ie>";
  }
  if (!configured.includes("<")) {
    return `FreeSpace <${configured}>`;
  }
  return configured;
}

export function getBookingEmailFrom() {
  const configured = normalize(process.env.EMAIL_FROM_BOOKINGS) ?? getDefaultEmailFrom();
  if (/no-reply@freespace\.ie/i.test(configured)) {
    return "FreeSpace <booking@freespace.ie>";
  }
  if (!configured.includes("<")) {
    return `FreeSpace <${configured}>`;
  }
  return configured;
}

export function getSupportEmailFrom() {
  const configured = normalize(process.env.EMAIL_FROM_SUPPORT) ?? getDefaultEmailFrom();
  if (/no-reply@freespace\.ie/i.test(configured)) {
    return "FreeSpace <support@freespace.ie>";
  }
  if (!configured.includes("<")) {
    return `FreeSpace <${configured}>`;
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
