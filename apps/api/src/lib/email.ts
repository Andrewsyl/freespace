import { sendMail } from "./mailer.js";
import { getBookingEmailFrom } from "./emailSenders.js";

export async function sendBookingEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  await sendMail({
    to,
    subject,
    text: body,
    html: `<pre style=\"font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; white-space: pre-wrap;\">${body}</pre>`,
    from: getBookingEmailFrom(),
  });
}
