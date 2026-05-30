import { sendMail } from "./mailer.js";
import { getBookingEmailFrom } from "./emailSenders.js";
import {
  buildBookingConfirmationEmail,
  buildBookingCancellationEmail,
} from "./emailTemplates.js";

export async function sendBookingStatusEmail({
  to,
  status,
  bookingId,
  listingTitle,
  listingAddress,
  windowText,
  accessCode,
  arrivalInstructions,
  receiptUrl,
}: {
  to: string;
  status: "confirmed" | "canceled";
  bookingId: string;
  listingTitle: string;
  listingAddress: string;
  windowText: string;
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  receiptUrl?: string | null;
}) {
  const subject =
    status === "confirmed"
      ? `Booking confirmed — ${listingTitle}`
      : `Booking cancelled — ${listingTitle}`;

  const html =
    status === "confirmed"
      ? buildBookingConfirmationEmail({ bookingId, listingTitle, listingAddress, windowText, accessCode, arrivalInstructions, receiptUrl })
      : buildBookingCancellationEmail({ listingTitle, listingAddress, windowText });

  const text =
    status === "confirmed"
      ? `Your parking booking is confirmed.\n\nRef: ${bookingId.slice(0, 8).toUpperCase()}\nLocation: ${listingTitle}\nAddress: ${listingAddress}\nTime: ${windowText}${accessCode ? `\nEntry code: ${accessCode}` : ""}${arrivalInstructions ? `\nArrival: ${arrivalInstructions}` : ""}${receiptUrl ? `\nReceipt: ${receiptUrl}` : ""}`
      : `Your booking for ${listingTitle} has been cancelled.\n\nTime: ${windowText}`;

  await sendMail({ to, subject, text, html, from: getBookingEmailFrom() });
}

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
    from: getBookingEmailFrom(),
  });
}
