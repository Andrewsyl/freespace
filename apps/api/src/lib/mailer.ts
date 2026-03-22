import "../loadEnv.js";
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const resendApiKey = process.env.RESEND_API_KEY?.trim();
const defaultFrom = process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? "no-reply@parkshare.local";

const transport =
  host && port && user && pass
    ? nodemailer.createTransport({
        host,
        port,
        auth: { user, pass },
      })
    : null;

export const isMailerConfigured = Boolean(transport || resendApiKey);

async function sendViaResend({
  to,
  subject,
  text,
  html,
  from,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from ?? defaultFrom,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const payload = (await response.text().catch(() => "")) || "Unknown Resend error";
    throw new Error(`Resend send failed: ${payload}`);
  }
}

export async function sendMail({
  to,
  subject,
  text,
  html,
  from,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}) {
  if (transport) {
    await transport.sendMail({ from: from ?? defaultFrom, to, subject, text, html });
    return;
  }
  if (resendApiKey) {
    await sendViaResend({ to, subject, text, html, from });
    return;
  }
  if (!transport && !resendApiKey) {
    console.warn("SMTP not configured. Email would be sent to:", to, subject, text);
    return;
  }
}
