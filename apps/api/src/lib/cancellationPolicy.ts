// Driver cancellation refund policy — the single source of truth for whether a
// cancellation returns money. The route (routes/bookings.ts) recomputes this
// server-side on every cancel; the client mirror in
// apps/mobile/utils/cancellationPolicy.ts exists ONLY to set button/dialog copy
// and must stay behaviourally identical to this file.
//
// Policy (peer-to-peer: a host blocks their single space, and at our liquidity a
// cancelled slot rarely re-lets, so late leniency just shifts the loss to the
// host):
//   - Full refund if cancelling at least FREE_CUTOFF before start (the host has
//     a realistic chance to re-let), OR within the post-booking grace window
//     (covers genuine mistakes at near-zero host cost).
//   - Otherwise non-refundable. Check-in (driver claimed the space), start time
//     (space is committed / partly used), and the final hours before start all
//     foreclose a refund.
// Cancelling still releases the space regardless of refund; that is the route's
// job, not this function's.

export const CANCELLATION_GRACE_MS = 15 * 60 * 1000;
export const CANCELLATION_FREE_CUTOFF_MS = 4 * 60 * 60 * 1000;

export type CancellationRefundReason =
  | "before_cutoff"
  | "grace_period"
  | "checked_in"
  | "after_start"
  | "inside_cutoff";

export type CancellationRefundInput = {
  /** Evaluation time, epoch ms. */
  nowMs: number;
  /** Booking start, epoch ms. */
  startMs: number;
  /** Booking creation, epoch ms. */
  createdAtMs: number;
  /** Whether the driver has checked in. */
  checkedIn: boolean;
};

export type CancellationRefundDecision = {
  refundEligible: boolean;
  reason: CancellationRefundReason;
};

export function evaluateCancellationRefund({
  nowMs,
  startMs,
  createdAtMs,
  checkedIn,
}: CancellationRefundInput): CancellationRefundDecision {
  // Check-in outranks everything: claiming the space forecloses a refund even
  // inside the grace window.
  if (checkedIn) {
    return { refundEligible: false, reason: "checked_in" };
  }
  // After start the space is committed / partly used — no refund of used time.
  if (nowMs >= startMs) {
    return { refundEligible: false, reason: "after_start" };
  }
  // Enough lead time for the host to re-let: full refund.
  if (startMs - nowMs >= CANCELLATION_FREE_CUTOFF_MS) {
    return { refundEligible: true, reason: "before_cutoff" };
  }
  // Inside the cutoff, but caught shortly after booking: mistake grace refund.
  if (nowMs - createdAtMs <= CANCELLATION_GRACE_MS) {
    return { refundEligible: true, reason: "grace_period" };
  }
  return { refundEligible: false, reason: "inside_cutoff" };
}
