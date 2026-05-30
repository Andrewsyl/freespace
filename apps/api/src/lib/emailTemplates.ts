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
  eyebrowColor = "#0fa968",
  title,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  secondary,
  footerLabel,
}: {
  eyebrow: string;
  eyebrowColor?: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondary?: string;
  footerLabel?: string;
}) {
  const logo = logoUrl();
  const cta =
    ctaLabel && ctaUrl
      ? `
        <a href="${esc(ctaUrl)}" style="display:inline-block; margin-top:8px; padding:13px 24px; background:#0fa968; color:#ffffff; border-radius:10px; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:-0.1px;">
          ${esc(ctaLabel)}
        </a>`
      : "";
  const secondaryHtml = secondary
    ? `<p style="margin:20px 0 0; font-size:13px; line-height:1.6; color:#6b7280;">${esc(secondary)}</p>`
    : "";
  const footer = footerLabel ?? "FreeSpace &middot; freespace.ie";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0; padding:0; background:#f5f7fb; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:24px 28px 20px; border-bottom:1px solid #e2e8f0;">
              <img src="${logo}" alt="FreeSpace" width="120" height="auto" style="display:block; height:auto; border:0;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 32px;">
              <div style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:${eyebrowColor}; margin-bottom:10px;">${esc(eyebrow)}</div>
              <h1 style="margin:0 0 16px; font-size:24px; line-height:1.25; font-weight:700; color:#111827; letter-spacing:-0.3px;">${esc(title)}</h1>
              ${bodyHtml}
              ${cta}
              ${secondaryHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px; background:#f8fafc; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:12px; color:#94a3b8;">${footer}</p>
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

function buildDetailRow(label: string, value: string, valueStyle = "") {
  return `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #f1f5f9; vertical-align:top; width:36%;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8;">${esc(label)}</span>
      </td>
      <td style="padding:10px 0 10px 16px; border-bottom:1px solid #f1f5f9; vertical-align:top;">
        <span style="font-size:14px; font-weight:600; color:#111827; ${valueStyle}">${esc(value)}</span>
      </td>
    </tr>`;
}

export function buildVerificationEmail(url: string) {
  return buildEmailShell({
    eyebrow: "FreeSpace account",
    title: "Verify your email",
    bodyHtml: `
      <p style="margin:0 0 24px; font-size:15px; line-height:1.65; color:#475569;">
        Confirm your email address to finish setting up your FreeSpace account and unlock bookings, payments, and hosting features.
      </p>
      <div style="margin:24px 0 0; padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
        <div style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px;">Fallback link</div>
        <a href="${esc(url)}" style="font-size:13px; color:#0fa968; font-weight:600; text-decoration:none; word-break:break-all;">${esc(url)}</a>
      </div>`,
    ctaLabel: "Verify email",
    ctaUrl: url,
    secondary: "If you did not create a FreeSpace account, you can ignore this message.",
    footerLabel: `FreeSpace Accounts &middot; ${getSenderAddress(getAuthEmailFrom())}`,
  });
}

export function buildPasswordResetEmail(url: string) {
  return buildEmailShell({
    eyebrow: "FreeSpace security",
    title: "Reset your password",
    bodyHtml: `
      <p style="margin:0 0 24px; font-size:15px; line-height:1.65; color:#475569;">
        Use the secure link below to set a new password for your FreeSpace account. This link expires in 1 hour.
      </p>
      <div style="margin:24px 0 0; padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
        <div style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px;">Fallback link</div>
        <a href="${esc(url)}" style="font-size:13px; color:#0fa968; font-weight:600; text-decoration:none; word-break:break-all;">${esc(url)}</a>
      </div>`,
    ctaLabel: "Reset password",
    ctaUrl: url,
    secondary: "If you did not request a password reset, you can ignore this email — your password will stay unchanged.",
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
    ? `
      <div style="margin:16px 0 0; padding:14px 16px; background:#edf7f2; border:1px solid #6ee7b7; border-radius:10px;">
        <div style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#065f46; margin-bottom:6px;">Entry code</div>
        <div style="font-size:22px; font-weight:800; color:#0fa968; letter-spacing:0.2em; font-family:monospace;">${esc(accessCode)}</div>
      </div>`
    : "";

  const instructionsBlock = arrivalInstructions
    ? `
      <div style="margin:12px 0 0; padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
        <div style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px;">Arrival instructions</div>
        <p style="margin:0; font-size:13px; line-height:1.6; color:#475569;">${esc(arrivalInstructions)}</p>
      </div>`
    : "";

  const detailsTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; border-collapse:separate; border-spacing:0;">
      <tbody style="background:#f8fafc; padding:0 16px;">
        ${buildDetailRow("Reference", `#${refShort}`)}
        ${buildDetailRow("Location", listingTitle)}
        ${buildDetailRow("Address", listingAddress)}
        ${buildDetailRow("Parking time", windowText)}
      </tbody>
    </table>
    ${accessCodeBlock}
    ${instructionsBlock}`;

  return buildEmailShell({
    eyebrow: "Booking confirmed",
    title: listingTitle,
    bodyHtml: `
      <p style="margin:0 0 20px; font-size:15px; line-height:1.65; color:#475569;">
        Your parking space is reserved. Here are your booking details.
      </p>
      ${detailsTable}`,
    ctaLabel: receiptUrl ? "View receipt" : undefined,
    ctaUrl: receiptUrl ?? undefined,
    secondary: "You'll receive a reminder before your parking session starts.",
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
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; border-collapse:separate; border-spacing:0;">
      <tbody style="background:#f8fafc; padding:0 16px;">
        ${buildDetailRow("Location", listingTitle)}
        ${buildDetailRow("Address", listingAddress)}
        ${buildDetailRow("Parking time", windowText)}
      </tbody>
    </table>`;

  return buildEmailShell({
    eyebrow: "Booking update",
    eyebrowColor: "#6b7280",
    title: "Your booking has been cancelled",
    bodyHtml: `
      <p style="margin:0 0 20px; font-size:15px; line-height:1.65; color:#475569;">
        Your booking for <strong style="color:#111827;">${esc(listingTitle)}</strong> has been cancelled. If you did not request this, please contact support.
      </p>
      ${detailsTable}`,
    ctaLabel: "Find parking",
    ctaUrl: `${webBase}/search`,
    footerLabel: "FreeSpace Bookings &middot; freespace.ie",
  });
}
