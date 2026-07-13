type ListingWithPricing = {
  pricePerDay: number;
  pricePerHour?: number | null;
  pricePerMonth?: number | null;
  rateType?: "hourly" | "daily" | null;
};

const DEFAULT_DAILY_HOURS = 8;

// Platform fee schedule — MUST mirror apps/api/src/lib/pricing.ts (the server
// verifies every client-sent amount against its own schedule and 400s on
// mismatch). The server serves its live schedule at GET /api/config; the
// defaults here match the server's env defaults for when that fetch fails.
// Mobile's mirror lives in apps/mobile/utils/pricing.ts — keep all three in sync.
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

export function getServiceFeeCents(parkingCents: number) {
  if (!Number.isFinite(parkingCents) || parkingCents <= 0) return 0;
  let fee = Math.round((parkingCents * feeSchedule.feeBps) / 10000);
  fee = Math.max(fee, feeSchedule.minFeeCents);
  if (feeSchedule.maxFeeCents != null) fee = Math.min(fee, feeSchedule.maxFeeCents);
  return fee;
}

// Buyer-facing gross in cents for an hourly/daily parking total in euro,
// matching the API's cent-level math exactly.
export function getGrossTotalCents(parkingEuro: number) {
  const parkingCents = Math.round(parkingEuro * 100);
  return parkingCents + getServiceFeeCents(parkingCents);
}

// Monthly gross rounds to the nearest whole euro — mirror of the API's
// monthlyGrossCents and mobile's getMonthlyGrossCents.
export function getMonthlyGrossCents(monthlyPrice: number, months = 1) {
  if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) return 0;
  const parkingCents = Math.round(monthlyPrice * months * 100);
  return Math.round((parkingCents + getServiceFeeCents(parkingCents)) / 100) * 100;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getExplicitHourlyPrice(listing: ListingWithPricing) {
  return typeof listing.pricePerHour === "number" && Number(listing.pricePerHour) > 0
    ? Number(listing.pricePerHour)
    : null;
}

function getExplicitDailyPrice(listing: ListingWithPricing) {
  return typeof listing.pricePerDay === "number" && Number(listing.pricePerDay) > 0
    ? Number(listing.pricePerDay)
    : null;
}

export function getListingRateType(listing: ListingWithPricing) {
  if (getExplicitHourlyPrice(listing) != null) {
    return "hourly";
  }
  return listing.rateType === "hourly" ? "hourly" : "daily";
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

export function getListingUnitLabel(listing: ListingWithPricing) {
  return getListingRateType(listing) === "hourly" ? "hr" : "day";
}

function formatElapsedDurationLabel(durationHours: number) {
  if (durationHours < 24) {
    return `${durationHours} hour${durationHours === 1 ? "" : "s"}`;
  }

  const fullDays = Math.floor(durationHours / 24);
  const remainingHours = durationHours % 24;

  if (remainingHours === 0) {
    return `${fullDays} day${fullDays === 1 ? "" : "s"}`;
  }

  return `${fullDays}d ${remainingHours}h`;
}

export function calculateListingTotal(listing: ListingWithPricing, start: Date, end: Date) {
  const durationHours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60)));
  const durationLabel = formatElapsedDurationLabel(durationHours);
  const dailyPrice = getExplicitDailyPrice(listing);
  const hourlyPrice =
    getExplicitHourlyPrice(listing) ??
    (dailyPrice != null ? roundMoney(dailyPrice / DEFAULT_DAILY_HOURS) : null);
  let total = 0;
  const billingCount = durationHours < 24 ? durationHours : Math.max(1, Math.ceil(durationHours / 24));
  const billingUnit: "hour" | "day" = durationHours < 24 ? "hour" : "day";

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
    total = roundMoney(dailyPrice * billingCount);
  }

  return {
    total: roundMoney(total),
    durationLabel,
    billingCount,
    billingUnit,
    dailyCapApplied,
    dailyCapSaving,
  };
}

export function formatListingPriceLine(listing: ListingWithPricing) {
  return `€${getListingUnitPrice(listing)} / ${getListingUnitLabel(listing)}`;
}

export function formatPriceValue(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/, "");
}
