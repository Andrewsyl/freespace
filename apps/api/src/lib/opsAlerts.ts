import { insertEventLog } from "./db.js";
import { isMailerConfigured, sendMail } from "./mailer.js";

const errorWebhookUrl = process.env.ERROR_REPORT_WEBHOOK_URL?.trim();
const supportEmail = process.env.SUPPORT_EMAIL?.trim() || process.env.EMAIL_FROM?.trim();

type OperationalAlertPayload = Record<string, unknown> | undefined;

export async function reportOperationalAlert({
  source,
  title,
  payload,
}: {
  source: string;
  title: string;
  payload?: OperationalAlertPayload;
}) {
  await insertEventLog({
    eventType: "operational_alert",
    payload: {
      source,
      title,
      ...(payload ?? {}),
    },
  });

  if (errorWebhookUrl) {
    try {
      await fetch(errorWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          title,
          payload: payload ?? null,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("[ops-alert] failed to deliver webhook alert", error);
    }
  }

  if (supportEmail && isMailerConfigured) {
    try {
      await sendMail({
        to: supportEmail,
        subject: `[FreeSpace Alert] ${title}`,
        text: `${source}\n\n${JSON.stringify(payload ?? {}, null, 2)}`,
        from: process.env.EMAIL_FROM_SUPPORT ?? process.env.EMAIL_FROM,
      });
    } catch (error) {
      console.error("[ops-alert] failed to deliver email alert", error);
    }
  }
}
