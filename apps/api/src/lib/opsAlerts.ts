import { insertEventLog } from "./db.js";
import { getSupportEmailFrom, getSupportEmailInbox } from "./emailSenders.js";
import { isMailerConfigured, sendMail } from "./mailer.js";

const errorWebhookUrl = process.env.ERROR_REPORT_WEBHOOK_URL?.trim();
const supportEmail = getSupportEmailInbox();

type OperationalAlertPayload = Record<string, unknown> | undefined;

export async function reportOperationalAlert({
  source,
  title,
  payload,
  sendEmail = true,
}: {
  source: string;
  title: string;
  payload?: OperationalAlertPayload;
  sendEmail?: boolean;
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

  if (sendEmail && supportEmail && isMailerConfigured) {
    try {
      await sendMail({
        to: supportEmail,
        subject: `[FreeSpace Alert] ${title}`,
        text: `${source}\n\n${JSON.stringify(payload ?? {}, null, 2)}`,
        from: getSupportEmailFrom(),
      });
    } catch (error) {
      console.error("[ops-alert] failed to deliver email alert", error);
    }
  }
}
