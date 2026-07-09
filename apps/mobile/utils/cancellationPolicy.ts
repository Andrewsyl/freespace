// Mirror of the API's driver cancellation refund policy
// (apps/api/src/lib/cancellationPolicy.ts). The server is the source of truth
// and recomputes the decision on every cancel; this copy exists ONLY to drive
// button/dialog copy on the booking detail screen, and MUST stay behaviourally
// identical to the server file — change both together, plus both test suites.

export const CANCELLATION_GRACE_MS = 15 * 60 * 1000;
export const CANCELLATION_FREE_CUTOFF_MS = 4 * 60 * 60 * 1000;

export type CancellationRefundReason =
  | "before_cutoff"
  | "grace_period"
  | "checked_in"
  | "after_start"
  | "inside_cutoff";

export type CancellationRefundInput = {
  nowMs: number;
  startMs: number;
  createdAtMs: number;
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
  if (checkedIn) {
    return { refundEligible: false, reason: "checked_in" };
  }
  if (nowMs >= startMs) {
    return { refundEligible: false, reason: "after_start" };
  }
  if (startMs - nowMs >= CANCELLATION_FREE_CUTOFF_MS) {
    return { refundEligible: true, reason: "before_cutoff" };
  }
  if (nowMs - createdAtMs <= CANCELLATION_GRACE_MS) {
    return { refundEligible: true, reason: "grace_period" };
  }
  return { refundEligible: false, reason: "inside_cutoff" };
}
