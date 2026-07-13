import { env } from "../env.js";

// Server-owned platform fee schedule (docs/PRICING_STRATEGY.md §3). The fee is
// applied to the host's parking price to produce the buyer-facing gross:
//
//   fee   = clamp(round(parking × bps/10000), minFee, maxFee)
//   gross = parking + fee
//
// With the default schedule (800 bps, no floor, no cap) this is bit-exact with
// the legacy `Math.round(parking × 1.08)` because parking is integer cents.
//
// PARITY INVARIANT: apps/mobile/utils/pricing.ts implements the same formula
// against the schedule served by GET /api/config. Change the formula in both
// places together (plus apps/web/lib/pricing.ts and both test suites) or every
// booking 400s with "price out of date".

export type PlatformFeeSchedule = {
  feeBps: number;
  minFeeCents: number;
  maxFeeCents: number | null;
};

export function getPlatformFeeSchedule(): PlatformFeeSchedule {
  return {
    feeBps: env.PLATFORM_FEE_BPS,
    minFeeCents: env.PLATFORM_MIN_FEE_CENTS,
    maxFeeCents: env.PLATFORM_MAX_FEE_CENTS,
  };
}

export function platformFeeCents(
  parkingCents: number,
  schedule: PlatformFeeSchedule = getPlatformFeeSchedule()
): number {
  if (!Number.isFinite(parkingCents) || parkingCents <= 0) return 0;
  let fee = Math.round((parkingCents * schedule.feeBps) / 10000);
  fee = Math.max(fee, schedule.minFeeCents);
  if (schedule.maxFeeCents != null) fee = Math.min(fee, schedule.maxFeeCents);
  return fee;
}

// Buyer-facing charge for an hourly/daily booking: parking + fee, cent-level.
export function grossFromParkingCents(
  parkingCents: number,
  schedule: PlatformFeeSchedule = getPlatformFeeSchedule()
): number {
  return parkingCents + platformFeeCents(parkingCents, schedule);
}

// Buyer-facing monthly gross is rounded to the nearest whole euro (no cents) —
// monthly rates are quoted as round numbers on every surface. Mirror of
// getMonthlyGrossCents in apps/mobile/utils/pricing.ts.
export function monthlyGrossFromParkingCents(
  parkingCents: number,
  schedule: PlatformFeeSchedule = getPlatformFeeSchedule()
): number {
  return Math.round(grossFromParkingCents(parkingCents, schedule) / 100) * 100;
}
