import type { ListingDetail, ListingSummary } from "../types";

type ListingWithPricing = Pick<ListingSummary, "price_per_day" | "price_per_hour" | "rate_type">;

const DEFAULT_DAILY_HOURS = 8;

// FreeSpace service fee. The API charges parking + fee at booking, where the
// fee comes from the server-owned schedule (apps/api/src/lib/pricing.ts):
//   fee = clamp(round(parking × bps/10000), minFee, maxFee)
// Every buyer-facing price must be quoted fee-inclusive — the number on the
// map IS the number at checkout — so this module MUST mirror the API formula
// against the schedule served by GET /api/config (fetched at app boot in
// remoteConfig.ts). The baked-in defaults below match the server's env
// defaults, so an offline start still prices correctly until the server's
// schedule diverges from its own defaults.
export type PlatformFeeSchedule = {
  feeBps: number;
  minFeeCents: number;
  maxFeeCents: number | null;
};

export const DEFAULT_FEE_SCHEDULE: PlatformFeeSchedule = {
  feeBps: 800,
  minFeeCents: 0,
  maxFeeCents: null,
};

let feeSchedule: PlatformFeeSchedule = DEFAULT_FEE_SCHEDULE;

export function setPlatformFeeSchedule(next: Partial<PlatformFeeSchedule> | null | undefined) {
  if (!next) return;
  const feeBps = Number(next.feeBps);
  const minFeeCents = Number(next.minFeeCents);
  // Reject junk wholesale — a partially-applied schedule would price
  // differently from the server and 400 every booking.
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 3000) return;
  if (!Number.isInteger(minFeeCents) || minFeeCents < 0 || minFeeCents > 500) return;
  const maxFeeCents =
    next.maxFeeCents == null
      ? null
      : Number.isInteger(Number(next.maxFeeCents)) && Number(next.maxFeeCents) > 0
        ? Number(next.maxFeeCents)
        : undefined;
  if (maxFeeCents === undefined) return;
  feeSchedule = { feeBps, minFeeCents, maxFeeCents };
}

// Legacy export — the display rate for copy like "8% service fee". Derived
// from the active schedule's percentage component only.
export const SERVICE_FEE_RATE = 0.08;

export function getServiceFeeCents(parkingCents: number) {
  if (!Number.isFinite(parkingCents) || parkingCents <= 0) return 0;
  let fee = Math.round((parkingCents * feeSchedule.feeBps) / 10000);
  fee = Math.max(fee, feeSchedule.minFeeCents);
  if (feeSchedule.maxFeeCents != null) fee = Math.min(fee, feeSchedule.maxFeeCents);
  return fee;
}

// Fee-inclusive price in euro for a base euro amount, matching the API's
// cent-level rounding exactly.
export function applyServiceFee(amount: number) {
  const cents = Math.round(amount * 100);
  return (cents + getServiceFeeCents(cents)) / 100;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getExplicitHourlyPrice(listing: ListingWithPricing) {
  return typeof listing.price_per_hour === "number" && Number(listing.price_per_hour) > 0
    ? Number(listing.price_per_hour)
    : null;
}

function getExplicitDailyPrice(listing: ListingWithPricing) {
  return typeof listing.price_per_day === "number" && Number(listing.price_per_day) > 0
    ? Number(listing.price_per_day)
    : null;
}

export function getListingRateType(listing: ListingWithPricing): "hourly" | "daily" {
  if (getExplicitHourlyPrice(listing) != null) {
    return "hourly";
  }
  return listing.rate_type === "hourly" ? "hourly" : "daily";
}

export function getListingUnitPrice(listing: ListingWithPricing) {
  const hourlyPrice = getExplicitHourlyPrice(listing);
  if (hourlyPrice != null) {
    return hourlyPrice;
  }
  const dailyPrice = getExplicitDailyPrice(listing);
  if (dailyPrice != null) {
    return roundMoney(dailyPrice / DEFAULT_DAILY_HOURS);
  }
  return 0;
}

export function getListingPriceUnitLabel(listing: ListingWithPricing) {
  return getListingRateType(listing) === "hourly" ? "hr" : "day";
}

function formatElapsedDurationLabel(durationHours: number) {
  if (durationHours < 24) {
    return `${durationHours} ${durationHours === 1 ? "hour" : "hours"}`;
  }

  const fullDays = Math.floor(durationHours / 24);
  const remainingHours = durationHours % 24;

  if (remainingHours === 0) {
    return `${fullDays} ${fullDays === 1 ? "day" : "days"}`;
  }

  return `${fullDays}d ${remainingHours}h`;
}

export function calculateListingTotal(listing: ListingWithPricing, start: Date, end: Date) {
  const ms = Math.max(0, end.getTime() - start.getTime());
  const durationHours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  const durationLabel = formatElapsedDurationLabel(durationHours);
  const dailyPrice = getExplicitDailyPrice(listing);
  const hourlyPrice =
    getExplicitHourlyPrice(listing) ??
    (dailyPrice != null ? roundMoney(dailyPrice / DEFAULT_DAILY_HOURS) : null);
  let total = 0;

  let dailyCapApplied = false;
  let dailyCapSaving = 0;

  if (dailyPrice != null && hourlyPrice != null) {
    const fullDays = Math.floor(durationHours / 24);
    const remainingHours = durationHours % 24;
    const rawRemaining = remainingHours > 0 ? roundMoney(hourlyPrice * remainingHours) : 0;
    const cappedRemaining = remainingHours > 0 ? Math.min(rawRemaining, dailyPrice) : 0;
    if (rawRemaining > dailyPrice) {
      dailyCapApplied = true;
      dailyCapSaving = roundMoney(rawRemaining - dailyPrice);
    }
    total = fullDays * dailyPrice + cappedRemaining;
  } else if (hourlyPrice != null) {
    total = roundMoney(hourlyPrice * durationHours);
  } else if (dailyPrice != null) {
    const billingDays = Math.max(1, Math.ceil(durationHours / 24));
    total = roundMoney(dailyPrice * billingDays);
  }

  const safeTotal = Math.max(0, roundMoney(total));
  const totalCents = Math.round(safeTotal * 100);
  const serviceFeeCents = getServiceFeeCents(totalCents);
  const grossTotalCents = totalCents + serviceFeeCents;

  // Fee-inclusive saving from the day cap: what the same hours would cost at
  // the hourly rate (gross) minus what the buyer actually pays (gross). This is
  // the ONE saving figure every buyer-facing surface should show, so the price
  // bar and the extend offer never quote two different numbers.
  const uncappedBase = safeTotal + dailyCapSaving; // capped total + the saving == raw hourly total
  const dailyCapSavingGross = dailyCapApplied
    ? roundMoney(applyServiceFee(uncappedBase) - grossTotalCents / 100)
    : 0;

  return {
    // Base parking amount — what the host earns. Buyer-facing UI should show
    // grossTotal, never this.
    total: safeTotal,
    totalCents,
    serviceFee: serviceFeeCents / 100,
    serviceFeeCents,
    // What the buyer actually pays (identical to the API's charge amount).
    grossTotal: grossTotalCents / 100,
    grossTotalCents,
    durationHours,
    durationLabel,
    dailyCapApplied,
    dailyCapSaving,
    dailyCapSavingGross,
  };
}

// Buyer-facing monthly price is rounded to the nearest whole euro (no cents) —
// on every surface (map pins, listing, favourites, booking summary) AND in the
// API's monthly charge check (`monthlyGrossCents` in
// apps/api/src/routes/bookings.ts). The two formulas MUST stay identical or a
// monthly booking 400s on the client-vs-server amount check ("price out of
// date"). `parkingCents` is what the host earns before the platform fee.
export function getMonthlyGrossCents(monthlyPrice: number, months = 1) {
  if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) return 0;
  const parkingCents = Math.round(monthlyPrice * months * 100);
  return Math.round((parkingCents + getServiceFeeCents(parkingCents)) / 100) * 100;
}

export function getMonthlyGrossEuro(monthlyPrice: number, months = 1) {
  return getMonthlyGrossCents(monthlyPrice, months) / 100;
}

// One-off single-month total. Mirrors the API's calculateMonthlyChargeCents
// (parking = round(monthlyPrice × 100) for a ~1-month span) plus the whole-euro
// gross fee, so the mobile quote matches what `/payment-intent` will accept for
// `mode: "monthly"`. Monthly is a flat rate — no daily proration or day-cap.
export function calculateMonthlyTotal(monthlyPrice: number) {
  const totalCents = Math.max(1, Math.round(monthlyPrice * 100));
  const grossTotalCents = Math.max(100, getMonthlyGrossCents(monthlyPrice));
  const serviceFeeCents = grossTotalCents - totalCents;
  return {
    total: totalCents / 100,
    totalCents,
    serviceFee: serviceFeeCents / 100,
    serviceFeeCents,
    grossTotal: grossTotalCents / 100,
    grossTotalCents,
    durationHours: 0,
    durationLabel: "1 month",
    dailyCapApplied: false,
    dailyCapSaving: 0,
    dailyCapSavingGross: 0,
  };
}

export function formatListingPriceLine(listing: ListingWithPricing) {
  return `€${getListingUnitPrice(listing)} / ${getListingPriceUnitLabel(listing)}`;
}

export function formatPriceValue(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export type ListingPricingDetail = ListingDetail | ListingSummary;
