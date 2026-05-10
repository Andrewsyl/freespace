import "../loadEnv.js";
import nodemailer from "nodemailer";
import { getDefaultEmailFrom } from "./emailSenders.js";

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const resendApiKey = process.env.RESEND_API_KEY?.trim();
const defaultFrom = getDefaultEmailFrom();

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

function isSesIdentityRejection(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Email address is not verified/i.test(message) || /Message rejected/i.test(message);
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
    try {
      await transport.sendMail({ from: from ?? defaultFrom, to, subject, text, html });
      return;
    } catch (error) {
      if (resendApiKey && isSesIdentityRejection(error)) {
        await sendViaResend({ to, subject, text, html, from });
        return;
      }
      throw error;
    }
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
