import {
  CANCELLATION_FREE_CUTOFF_MS,
  CANCELLATION_GRACE_MS,
  evaluateCancellationRefund,
} from "../utils/cancellationPolicy";

const START = new Date("2026-07-10T12:00:00.000Z").getTime();
const HOUR = 60 * 60 * 1000;

// Mirror of apps/api/tests/cancellationPolicy.test.ts — the two policy
// implementations must agree, so the case table is kept identical.
describe("evaluateCancellationRefund", () => {
  it("refunds when cancelling at least the free cutoff before start", () => {
    expect(
      evaluateCancellationRefund({
        nowMs: START - 5 * HOUR,
        startMs: START,
        createdAtMs: START - 6 * HOUR,
        checkedIn: false,
      })
    ).toEqual({ refundEligible: true, reason: "before_cutoff" });
  });

  it("treats exactly the cutoff as still refundable", () => {
    expect(
      evaluateCancellationRefund({
        nowMs: START - CANCELLATION_FREE_CUTOFF_MS,
        startMs: START,
        createdAtMs: START - 6 * HOUR,
        checkedIn: false,
      }).refundEligible
    ).toBe(true);
  });

  it("does not refund inside the cutoff once past the grace window", () => {
    expect(
      evaluateCancellationRefund({
        nowMs: START - 3 * HOUR,
        startMs: START,
        createdAtMs: START - 6 * HOUR,
        checkedIn: false,
      })
    ).toEqual({ refundEligible: false, reason: "inside_cutoff" });
  });

  it("refunds inside the cutoff when still within the grace window", () => {
    const now = START - 3 * HOUR;
    expect(
      evaluateCancellationRefund({
        nowMs: now,
        startMs: START,
        createdAtMs: now - (CANCELLATION_GRACE_MS - 60_000),
        checkedIn: false,
      })
    ).toEqual({ refundEligible: true, reason: "grace_period" });
  });

  it("never refunds once checked in, even with lead time to spare", () => {
    expect(
      evaluateCancellationRefund({
        nowMs: START - 5 * HOUR,
        startMs: START,
        createdAtMs: START - 5 * HOUR,
        checkedIn: true,
      })
    ).toEqual({ refundEligible: false, reason: "checked_in" });
  });

  it("does not refund after start", () => {
    expect(
      evaluateCancellationRefund({
        nowMs: START + 60_000,
        startMs: START,
        createdAtMs: START + 30_000,
        checkedIn: false,
      })
    ).toEqual({ refundEligible: false, reason: "after_start" });
  });

  it("does not refund a few minutes before start (the reported gap)", () => {
    const decision = evaluateCancellationRefund({
      nowMs: START - 3 * 60_000,
      startMs: START,
      createdAtMs: START - 2 * HOUR,
      checkedIn: false,
    });
    expect(decision.refundEligible).toBe(false);
    expect(decision.reason).toBe("inside_cutoff");
  });
});
