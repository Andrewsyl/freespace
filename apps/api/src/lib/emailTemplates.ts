import "../loadEnv.js";
import { getAuthEmailFrom, getSenderAddress } from "./emailSenders.js";

function logoUrl() {
  const webBase = (process.env.WEB_BASE_URL ?? "https://freespace.ie").replace(/\/$/, "");
  return `${webBase}/freespace-logo.png`;
}

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
        <a href="${esc(ctaUrl)}" style="display:inline-block; padding:14px 32px; background:#0fa968; color:#ffffff; border-radius:999px; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:-0.1px;">
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
  <style>
    /* ── Light mode (default) ── */
    body, .email-body   { background-color: #ffffff !important; color: #111827 !important; }
    .email-card         { background-color: #ffffff !important; }
    .email-footer       { background-color: #f8fafc !important; }
    .email-heading      { color: #111827 !important; }
    .email-body-text    { color: #475569 !important; }
    .email-muted        { color: #94a3b8 !important; }
    .logo-img           { filter: none !important; }
    .icon-circle        { background-color: #edf7f2 !important; }

    /* ── Dark mode — look intentional rather than broken ── */
    @media (prefers-color-scheme: dark) {
      body, .email-body { background-color: #0f1117 !important; color: #f1f5f9 !important; }
      .email-card       { background-color: #1a1f2e !important; }
      .email-footer     { background-color: #111827 !important; border-top-color: #1e293b !important; }
      .email-heading    { color: #f8fafc !important; }
      .email-body-text  { color: #94a3b8 !important; }
      .email-muted      { color: #475569 !important; }
      /* Flip the dark logo to white */
      .logo-img         { filter: brightness(0) invert(1) !important; }
      .icon-circle      { background-color: #064e3b !important; }
    }
  </style>
</head>
<body class="email-body" bgcolor="#ffffff" style="margin:0; padding:0; background-color:#ffffff; color:#111827; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table class="email-body" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background-color:#ffffff; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo + eyebrow -->
          <tr>
            <td style="text-align:center; padding-bottom:24px;">
              <img class="logo-img" src="${logo}" alt="FreeSpace" width="130" height="auto" style="display:inline-block; height:auto; border:0;" />
              <div style="margin-top:14px; font-size:11px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:#0fa968;">
                ${esc(eyebrow)}
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="email-card" bgcolor="#ffffff" style="background-color:#ffffff; border-radius:18px; overflow:hidden;">
              <div style="padding:36px 32px 32px;">

                ${iconBlock}

                <h1 class="email-heading" style="margin:0 0 12px; font-size:26px; line-height:1.2; font-weight:800; color:#111827; text-align:center; letter-spacing:-0.4px;">
                  ${esc(title)}
                </h1>

                ${bodyHtml}
                ${cta}

              </div>

              <!-- Footer -->
              <div class="email-footer" style="padding:16px 32px; background-color:#f8fafc; border-top:1px solid #f1f5f9; text-align:center;">
                <p class="email-muted" style="margin:0; font-size:12px; color:#94a3b8;">${footer}</p>
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
      <td style="padding:10px 0; border-bottom:1px solid #f1f5f9; vertical-align:top; width:36%;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8;">${esc(label)}</span>
      </td>
      <td style="padding:10px 0 10px 16px; border-bottom:1px solid #f1f5f9; vertical-align:top;">
        <span style="font-size:14px; font-weight:600; color:#111827;">${esc(value)}</span>
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
      <p class="email-body-text" style="margin:0 0 20px; font-size:15px; line-height:1.65; color:#475569; text-align:center;">
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
      <p class="email-body-text" style="margin:0 0 20px; font-size:15px; line-height:1.65; color:#475569; text-align:center;">
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

export function buildBookingConfirmationEmail({
  bookingId,
  listingTitle,
  listingAddress,
  windowText,
  accessCode,
  arrivalInstructions,
  receiptUrl,
}: {
  bookingId: string;
  listingTitle: string;
  listingAddress: string;
  windowText: string;
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  receiptUrl?: string | null;
}) {
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
        <p style="margin:0; font-size:13px; line-height:1.6; color:#475569;">${esc(arrivalInstructions)}</p>
      </div>`
    : "";

  const detailsTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px; border-collapse:collapse;">
      ${buildDetailRow("Reference", `#${refShort}`)}
      ${buildDetailRow("Location", listingTitle)}
      ${buildDetailRow("Address", listingAddress)}
      ${buildDetailRow("Parking time", windowText)}
    </table>
    ${accessCodeBlock}
    ${instructionsBlock}`;

  return buildEmailShell({
    eyebrow: "Booking confirmed",
    title: "You're booked in",
    bodyHtml: `
      <p style="margin:0 0 24px; font-size:15px; line-height:1.65; color:#475569; text-align:center;">
        Your parking space at <strong style="color:#111827;">${esc(listingTitle)}</strong> is confirmed.
      </p>
      ${detailsTable}
      <p style="margin:20px 0 0; font-size:13px; color:#94a3b8; text-align:center;">
        You'll receive a reminder before your session starts.
      </p>`,
    ctaLabel: receiptUrl ? "View receipt" : undefined,
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
      <p style="margin:0 0 24px; font-size:15px; line-height:1.65; color:#475569; text-align:center;">
        Your booking for <strong style="color:#111827;">${esc(listingTitle)}</strong> has been cancelled. If you did not request this, please contact support.
      </p>
      ${detailsTable}`,
    ctaLabel: "Find parking",
    ctaUrl: `${webBase}/search`,
    footerLabel: "FreeSpace Bookings &middot; freespace.ie",
  });
}
