import "../loadEnv.js";
import { getAuthEmailFrom, getSenderAddress } from "./emailSenders.js";

function logoUrl() {
  return "https://www.freespace.ie/freespace-logo.png";
}

const WHITE_LOGO_DATA_URI = "data:image/png;base64,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AAAAAAAlCLYAAAAAAAAoQbAFAAAAAABACYItAAAAAAAAShBsAQAAAAAAUIJgCwAAAAAAgBIEWwAAAAAAAJQg2AIAAAAAAKAEwRYAAAAAAAAlCLYAAAAAAAAoQbAFAAAAAABACYItAAAAAAAAShBsAQAAAAAAUIJgCwAAAAAAgBIEWwAAAAAAAJQg2AIAAAAAAKAEwRYAAAAAAAAlCLYAAAAAAAAoQbAFAAAAAABACYItAAAAAAAAShBsAQAAAAAAUIJgCwAAAAAAgBIEWwAAAAAAAJQg2AIAAAAAAKAEwRYAAAAAAAAlCLYAAAAAAAAoQbAFAAAAAABACYItAAAAAAAAShBsAQAAAAAAUIJgCwAAAAAAgBIEWwAAAAAAAJQg2AIAAAAAAKAEwRYAAAAAAAAlCLYAAAAAAAAoQbAFAAAAAABACYItAAAAAAAAShBsAQAAAAAAUIJgCwAAAAAAgBIEWwAAAAAAAJQg2AIAAAAAAKAEwRYAAAAAAAAlCLYAAAAAAAAoQbAFAAAAAABACYItAAAAAAAAShBsAQAAAAAAUIJgCwAAAAAAgBIEWwAAAAAAAJQg2AIAAAAAAKAEwRYAAAAAAAAlCLYAAAAAAAAo4X+55zKVU4e9xwAAAABJRU5ErkJggg==";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailShell({
  eyebrow,
  title,
  iconSvg,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerLabel,
}: {
  eyebrow: string;
  title: string;
  iconSvg?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerLabel?: string;
}) {
  const logo = logoUrl();

  const iconBlock = iconSvg
    ? `
      <div style="text-align:center; margin-bottom:20px;">
        <div class="icon-circle" style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:50%; background-color:#edf7f2;">
          ${iconSvg}
        </div>
      </div>`
    : "";

  const cta = ctaLabel && ctaUrl
    ? `
      <div style="text-align:center; margin-top:28px;">
        <a href="${esc(ctaUrl)}" style="display:inline-block; padding:14px 32px; background:#0a8050; color:#ffffff; border-radius:14px; text-decoration:none; font-size:15px; font-weight:600; letter-spacing:-0.015em; font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          ${esc(ctaLabel)}
        </a>
      </div>`
    : "";

  const footer = footerLabel ?? "FreeSpace &middot; freespace.ie";

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
  <style>
    /* ── Light mode (default) ── */
    body, .email-body   { background-color: #F7F7F6 !important; color: #0f172a !important; }
    .email-card         { background-color: #ffffff !important; }
    .email-footer       { background-color: #F7F7F6 !important; }
    .email-heading      { color: #0f172a !important; }
    .email-body-text    { color: #374151 !important; }
    .email-muted        { color: #6b7280 !important; }
    .icon-circle        { background-color: #edf7f2 !important; }

    /* ── Dark mode — look intentional rather than broken ── */
    @media (prefers-color-scheme: dark) {
      body, .email-body { background-color: #0f1117 !important; color: #f1f5f9 !important; }
      .email-card       { background-color: #1a1f2e !important; }
      .email-footer     { background-color: #111827 !important; border-top-color: #1e293b !important; }
      .email-heading    { color: #f8fafc !important; }
      .email-body-text  { color: #94a3b8 !important; }
      .email-muted      { color: #475569 !important; }
      .icon-circle      { background-color: #064e3b !important; }
      .logo-light       { display: none !important; }
      .logo-dark        { display: inline-block !important; }
    }
  </style>
</head>
<body class="email-body" bgcolor="#F7F7F6" style="margin:0; padding:0; background-color:#F7F7F6; color:#0f172a; font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table class="email-body" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F7F7F6" style="background-color:#F7F7F6; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Card -->
          <tr>
            <td class="email-card" bgcolor="#ffffff" style="background-color:#ffffff; border-radius:16px; border:1px solid #e5e7eb; overflow:hidden;">

              <!-- Logo header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td bgcolor="#F7F7F6" style="background-color:#F7F7F6; padding:24px 32px; text-align:center; border-bottom:1px solid #e5e7eb;">
                    <img src="${logo}" alt="FreeSpace" width="140" height="auto" style="display:inline-block; height:auto; border:0;" />
                  </td>
                </tr>
              </table>

              <div style="padding:36px 32px 32px;">
                <div style="text-align:center; margin-bottom:20px; font-size:11px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:#0a8050;">
                  ${esc(eyebrow)}
                </div>

                ${iconBlock}

                <h1 class="email-heading" style="margin:0 0 12px; font-size:26px; line-height:1.2; font-weight:800; color:#0f172a; text-align:center; letter-spacing:-0.04em; font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  ${esc(title)}
                </h1>

                ${bodyHtml}
                ${cta}

              </div>

              <!-- Footer -->
              <div class="email-footer" style="padding:16px 32px; background-color:#F7F7F6; border-top:1px solid #e5e7eb; text-align:center;">
                <p class="email-muted" style="margin:0; font-size:12px; color:#6b7280;">${footer}</p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildDetailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:11px 0; border-bottom:1px solid #e5e7eb; vertical-align:top; width:36%;">
        <span style="font-size:12px; font-weight:500; color:#6b7280;">${esc(label)}</span>
      </td>
      <td style="padding:11px 0 11px 16px; border-bottom:1px solid #e5e7eb; vertical-align:top;">
        <span style="font-size:13px; font-weight:600; color:#0f172a;">${esc(value)}</span>
      </td>
    </tr>`;
}

const envelopeIcon = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0fa968" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
</svg>`;

const lockIcon = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0fa968" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="11" width="14" height="10" rx="2"/>
  <path d="M8 11V7a4 4 0 018 0v4"/>
</svg>`;

const checkIcon = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0fa968" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
  <polyline points="22 4 12 14.01 9 11.01"/>
</svg>`;

export function buildVerificationEmail(url: string) {
  return buildEmailShell({
    eyebrow: "FreeSpace account",
    title: "Verify your email",
    bodyHtml: `
      <p class="email-body-text" style="margin:0 0 20px; font-size:15px; line-height:1.65; color:#374151; text-align:center;">
        Confirm your email address to finish setting up your FreeSpace account and unlock bookings, payments, and hosting features.
      </p>
      <div style="margin:20px 0 0; padding:12px 16px; background:#f8fafc; border-radius:10px; text-align:center;">
        <a href="${esc(url)}" style="font-size:12px; color:#0fa968; font-weight:600; text-decoration:none; word-break:break-all;">${esc(url)}</a>
      </div>
      <p style="margin:16px 0 0; font-size:13px; color:#94a3b8; text-align:center;">
        If you did not create a FreeSpace account, you can ignore this message.
      </p>`,
    ctaLabel: "Verify email",
    ctaUrl: url,
    footerLabel: `FreeSpace Accounts &middot; ${getSenderAddress(getAuthEmailFrom())}`,
  });
}

export function buildPasswordResetEmail(url: string) {
  return buildEmailShell({
    eyebrow: "Account recovery",
    title: "Reset your password",
    bodyHtml: `
      <p class="email-body-text" style="margin:0 0 20px; font-size:15px; line-height:1.65; color:#374151; text-align:center;">
        We received a request to reset your FreeSpace password. Click the button below — this link expires in 1 hour.
      </p>
      <div style="margin:20px 0 0; padding:12px 16px; background:#f8fafc; border-radius:10px; text-align:center;">
        <a href="${esc(url)}" style="font-size:12px; color:#0fa968; font-weight:600; text-decoration:none; word-break:break-all;">${esc(url)}</a>
      </div>
      <p style="margin:16px 0 0; font-size:13px; color:#94a3b8; text-align:center;">
        If you did not request this, your password will stay unchanged.
      </p>`,
    ctaLabel: "Reset password",
    ctaUrl: url,
    footerLabel: `FreeSpace Accounts &middot; ${getSenderAddress(getAuthEmailFrom())}`,
  });
}

function buildGoogleCalendarUrl({
  title,
  location,
  startTime,
  endTime,
}: {
  title: string;
  location: string;
  startTime: Date;
  endTime: Date;
}) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(startTime)}/${fmt(endTime)}`,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatTimeBlock(startTime: Date, endTime: Date) {
  const tz = "Europe/Dublin";
  const fmtDate = (d: Date) => d.toLocaleDateString("en-IE", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });
  const fmtTime = (d: Date) => d.toLocaleTimeString("en-IE", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const startDate = fmtDate(startTime);
  const endDate = fmtDate(endTime);
  const sameDay = startDate === endDate;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border-collapse:collapse;">
      <tr>
        <td style="text-align:left; width:42%; vertical-align:top;">
          <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">${startDate}</div>
          <div style="font-size:26px; font-weight:800; color:#0f172a; letter-spacing:-0.04em; line-height:1.15;">${fmtTime(startTime)}</div>
        </td>
        <td style="text-align:center; width:16%; vertical-align:middle; padding-top:18px; font-size:18px; color:#d1d5db;">&#8594;</td>
        <td style="text-align:right; width:42%; vertical-align:top;">
          <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">${sameDay ? "&nbsp;" : endDate}</div>
          <div style="font-size:26px; font-weight:800; color:#0f172a; letter-spacing:-0.04em; line-height:1.15;">${fmtTime(endTime)}</div>
        </td>
      </tr>
    </table>
    <hr style="border:none; border-top:1px solid #e5e7eb; margin:0 0 20px;" />`;
}

export function buildBookingConfirmationEmail({
  bookingId,
  listingTitle,
  listingAddress,
  windowText,
  startTime,
  endTime,
  accessCode,
  arrivalInstructions,
  receiptUrl,
  amountCents,
  vehiclePlate,
}: {
  bookingId: string;
  listingTitle: string;
  listingAddress: string;
  windowText: string;
  startTime: Date;
  endTime: Date;
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  receiptUrl?: string | null;
  amountCents?: number | null;
  vehiclePlate?: string | null;
}) {
  const webBase = (process.env.WEB_BASE_URL ?? "https://www.freespace.ie").replace(/\/$/, "");
  const refShort = bookingId.slice(0, 8).toUpperCase();

  const accessCodeBlock = accessCode
    ? `<div style="margin:16px 0 0; padding:16px; background:#edf7f2; border-radius:12px; text-align:center;">
        <div style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#065f46; margin-bottom:8px;">Entry code</div>
        <div style="font-size:26px; font-weight:800; color:#0fa968; letter-spacing:0.25em; font-family:monospace;">${esc(accessCode)}</div>
      </div>`
    : "";

  const instructionsBlock = arrivalInstructions
    ? `<div style="margin:12px 0 0; padding:14px 16px; background:#f8fafc; border-radius:10px;">
        <div style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px;">Arrival instructions</div>
        <p style="margin:0; font-size:13px; line-height:1.6; color:#374151;">${esc(arrivalInstructions)}</p>
      </div>`
    : "";

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listingAddress)}`;
  const calendarUrl = buildGoogleCalendarUrl({
    title: `Parking — ${listingTitle}`,
    location: listingAddress,
    startTime,
    endTime,
  });

  const bookingDeepLink = `https://freespace.ie/bookings/${bookingId}`;

  const actionLinks = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0; border-top:1px solid #e5e7eb; border-collapse:collapse;">
      <tr>
        <td style="padding:13px 0; border-bottom:1px solid #e5e7eb;">
          <a href="${esc(bookingDeepLink)}" style="text-decoration:none; display:block;">
            <table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%;">
              <tr>
                <td style="width:36px; vertical-align:middle;">
                  <div style="width:32px; height:32px; border-radius:16px; background:#ECFDF5; text-align:center; line-height:32px; font-size:15px;">&#128337;</div>
                </td>
                <td style="padding-left:12px; vertical-align:middle; font-size:14px; font-weight:600; color:#0f172a;">View booking in app</td>
                <td style="text-align:right; vertical-align:middle; font-size:16px; color:#0a8050;">&#8250;</td>
              </tr>
            </table>
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 0; border-bottom:1px solid #e5e7eb;">
          <a href="${esc(mapsUrl)}" style="text-decoration:none; display:block;">
            <table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%;">
              <tr>
                <td style="width:36px; vertical-align:middle;">
                  <div style="width:32px; height:32px; border-radius:16px; background:#ECFDF5; text-align:center; line-height:32px; font-size:15px;">&#128205;</div>
                </td>
                <td style="padding-left:12px; vertical-align:middle; font-size:14px; font-weight:600; color:#0f172a;">Get directions</td>
                <td style="text-align:right; vertical-align:middle; font-size:16px; color:#0a8050;">&#8250;</td>
              </tr>
            </table>
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 0;">
          <a href="${esc(calendarUrl)}" style="text-decoration:none; display:block;">
            <table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%;">
              <tr>
                <td style="width:36px; vertical-align:middle;">
                  <div style="width:32px; height:32px; border-radius:16px; background:#ECFDF5; text-align:center; line-height:32px; font-size:15px;">&#128197;</div>
                </td>
                <td style="padding-left:12px; vertical-align:middle; font-size:14px; font-weight:600; color:#0f172a;">Add to calendar</td>
                <td style="text-align:right; vertical-align:middle; font-size:16px; color:#0a8050;">&#8250;</td>
              </tr>
            </table>
          </a>
        </td>
      </tr>
    </table>`;

  const priceFormatted = amountCents != null ? `€${(amountCents / 100).toFixed(2)}` : null;

  const detailsTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px; border-collapse:collapse;">
      ${buildDetailRow("Reference", `#${refShort}`)}
      ${buildDetailRow("Location", listingTitle)}
      ${buildDetailRow("Address", listingAddress)}
      ${vehiclePlate ? buildDetailRow("Vehicle", vehiclePlate) : ""}
      ${priceFormatted ? buildDetailRow("Total paid", priceFormatted) : ""}
    </table>
    ${accessCodeBlock}
    ${instructionsBlock}
    ${actionLinks}`;

  const cancelSection = `
    <div style="margin:24px 0 0; padding-top:20px; border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 4px; font-size:13px; font-weight:700; color:#0f172a;">Need to cancel?</p>
      <p style="margin:0; font-size:13px; color:#374151; line-height:1.55;">Cancel before your session starts for a full refund. <a href="${esc(`${webBase}/dashboard/bookings`)}" style="color:#0a8050; text-decoration:none; font-weight:600;">Manage booking &#8594;</a></p>
    </div>`;

  const helpSection = `
    <div style="margin:16px 0 0; text-align:center;">
      <p style="margin:0; font-size:12px; color:#6b7280;">
        Questions? <a href="mailto:hello@freespace.ie" style="color:#6b7280; text-decoration:underline;">hello@freespace.ie</a>
      </p>
    </div>`;

  return buildEmailShell({
    eyebrow: "Booking confirmed",
    title: "You're booked in",
    bodyHtml: `
      ${formatTimeBlock(startTime, endTime)}
      ${detailsTable}
      ${cancelSection}
      ${helpSection}`,
    ctaLabel: receiptUrl ? "Download receipt" : undefined,
    ctaUrl: receiptUrl ?? undefined,
    footerLabel: "FreeSpace Bookings &middot; freespace.ie",
  });
}

export function buildBookingCancellationEmail({
  listingTitle,
  listingAddress,
  windowText,
}: {
  listingTitle: string;
  listingAddress: string;
  windowText: string;
}) {
  const webBase = (process.env.WEB_BASE_URL ?? "https://freespace.ie").replace(/\/$/, "");

  const detailsTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px; border-collapse:collapse;">
      ${buildDetailRow("Location", listingTitle)}
      ${buildDetailRow("Address", listingAddress)}
      ${buildDetailRow("Parking time", windowText)}
    </table>`;

  return buildEmailShell({
    eyebrow: "Booking update",
    title: "Booking cancelled",
    bodyHtml: `
      <p style="margin:0 0 24px; font-size:15px; line-height:1.65; color:#374151; text-align:center;">
        Your booking for <strong style="color:#111827;">${esc(listingTitle)}</strong> has been cancelled. If you did not request this, please contact support.
      </p>
      ${detailsTable}`,
    ctaLabel: "Find parking",
    ctaUrl: `${webBase}/search`,
    footerLabel: "FreeSpace Bookings &middot; freespace.ie",
  });
}
