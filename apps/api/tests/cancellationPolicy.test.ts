import { describe, expect, it } from "vitest";
import {
  CANCELLATION_FREE_CUTOFF_MS,
  CANCELLATION_GRACE_MS,
  evaluateCancellationRefund,
} from "../src/lib/cancellationPolicy.js";

const START = new Date("2026-07-10T12:00:00.000Z").getTime();
const HOUR = 60 * 60 * 1000;

describe("evaluateCancellationRefund", () => {
  it("refunds when cancelling at least the free cutoff before start", () => {
    const decision = evaluateCancellationRefund({
      nowMs: START - 5 * HOUR,
      startMs: START,
      createdAtMs: START - 6 * HOUR, // outside grace, so this is the cutoff path
      checkedIn: false,
    });
    expect(decision).toEqual({ refundEligible: true, reason: "before_cutoff" });
  });

  it("treats exactly the cutoff as still refundable", () => {
    const decision = evaluateCancellationRefund({
      nowMs: START - CANCELLATION_FREE_CUTOFF_MS,
      startMs: START,
      createdAtMs: START - 6 * HOUR,
      checkedIn: false,
    });
    expect(decision.refundEligible).toBe(true);
    expect(decision.reason).toBe("before_cutoff");
  });

  it("does not refund inside the cutoff once past the grace window", () => {
    const decision = evaluateCancellationRefund({
      nowMs: START - 3 * HOUR,
      startMs: START,
      createdAtMs: START - 6 * HOUR, // booked long ago, grace expired
      checkedIn: false,
    });
    expect(decision).toEqual({ refundEligible: false, reason: "inside_cutoff" });
  });

  it("refunds inside the cutoff when still within the post-booking grace window", () => {
    const now = START - 3 * HOUR;
    const decision = evaluateCancellationRefund({
      nowMs: now,
      startMs: START,
      createdAtMs: now - (CANCELLATION_GRACE_MS - 60_000), // 14 min ago
      checkedIn: false,
    });
    expect(decision).toEqual({ refundEligible: true, reason: "grace_period" });
  });

  it("treats exactly the grace boundary as still refundable", () => {
    const now = START - 3 * HOUR;
    const decision = evaluateCancellationRefund({
      nowMs: now,
      startMs: START,
      createdAtMs: now - CANCELLATION_GRACE_MS,
      checkedIn: false,
    });
    expect(decision.refundEligible).toBe(true);
    expect(decision.reason).toBe("grace_period");
  });

  it("never refunds once checked in, even with lead time to spare", () => {
    const decision = evaluateCancellationRefund({
      nowMs: START - 5 * HOUR,
      startMs: START,
      createdAtMs: START - 5 * HOUR,
      checkedIn: true,
    });
    expect(decision).toEqual({ refundEligible: false, reason: "checked_in" });
  });

  it("does not refund after start", () => {
    const decision = evaluateCancellationRefund({
      nowMs: START + 60_000,
      startMs: START,
      createdAtMs: START + 30_000, // just-booked but already started
      checkedIn: false,
    });
    expect(decision).toEqual({ refundEligible: false, reason: "after_start" });
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
