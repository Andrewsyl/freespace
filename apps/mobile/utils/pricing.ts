import type { ListingDetail, ListingSummary } from "../types";

type ListingWithPricing = Pick<ListingSummary, "price_per_day" | "price_per_hour" | "rate_type">;

const DEFAULT_DAILY_HOURS = 8;

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

  return {
    total: Math.max(0, roundMoney(total)),
    totalCents: Math.round(Math.max(0, roundMoney(total)) * 100),
    durationHours,
    durationLabel,
    dailyCapApplied,
    dailyCapSaving,
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
