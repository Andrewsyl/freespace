import { stripe } from "./stripe.js";
import {
  insertEventLog,
  listStalePendingBookings,
  updateBookingStatusByPaymentIntent,
} from "./db.js";
import { logWarn } from "./logger.js";

// Abandoned payment-sheet attempts leave a 'pending' booking that counts
// against listing capacity indefinitely (the PaymentIntent never expires on
// its own). Cancel the intent and the booking once the attempt is clearly
// dead. 30 minutes is far beyond any legitimate payment-sheet session.
const STALE_AFTER_MINUTES = 30;

export async function sweepStalePendingBookings(limit = 25) {
  if (!stripe) return;
  const stale = await listStalePendingBookings({
    olderThanMinutes: STALE_AFTER_MINUTES,
    limit,
  });
  for (const booking of stale) {
    try {
      const intent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
      if (intent.status === "succeeded" || intent.status === "processing") {
        // Paid (or still settling): confirmation belongs to the webhook /
        // client confirm path — never cancel a paid booking here.
        continue;
      }
      if (intent.status !== "canceled") {
        try {
          await stripe.paymentIntents.cancel(booking.payment_intent_id);
        } catch (cancelError) {
          logWarn("booking-sweeper.intent_cancel_failed", {
            bookingId: booking.id,
            paymentIntentId: booking.payment_intent_id,
            message: cancelError instanceof Error ? cancelError.message : String(cancelError),
          });
        }
      }
      await updateBookingStatusByPaymentIntent({
        paymentIntentId: booking.payment_intent_id,
        status: "canceled",
      });
      await insertEventLog({
        eventType: "stale_pending_booking_swept",
        payload: {
          bookingId: booking.id,
          paymentIntentId: booking.payment_intent_id,
          intentStatus: intent.status,
        },
      });
    } catch (error) {
      logWarn("booking-sweeper.failed", {
        bookingId: booking.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
