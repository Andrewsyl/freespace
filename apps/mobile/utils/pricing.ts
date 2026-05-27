import type { ListingDetail, ListingSummary } from "../types";

type ListingWithPricing = Pick<ListingSummary, "price_per_day" | "price_per_hour" | "rate_type">;

const DEFAULT_DAILY_HOURS = 8;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getListingRateType(listing: ListingWithPricing): "hourly" | "daily" {
  if (typeof listing.price_per_hour === "number" && Number(listing.price_per_hour) > 0) {
    return "hourly";
  }
  return listing.rate_type === "hourly" ? "hourly" : "daily";
}

export function getListingUnitPrice(listing: ListingWithPricing) {
  if (typeof listing.price_per_hour === "number" && Number(listing.price_per_hour) > 0) {
    return Number(listing.price_per_hour);
  }
  if (typeof listing.price_per_day === "number" && Number(listing.price_per_day) > 0) {
    return roundMoney(Number(listing.price_per_day) / DEFAULT_DAILY_HOURS);
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

  if (durationHours < 24) {
    const total = Math.max(0, roundMoney(getListingUnitPrice(listing) * durationHours));
    return {
      total,
      totalCents: Math.round(total * 100),
      durationHours,
      durationLabel,
    };
  }

  const billingDays = Math.max(1, Math.ceil(durationHours / 24));
  const total = Math.max(0, roundMoney(getListingUnitPrice(listing) * billingDays));
  return {
    total,
    totalCents: Math.round(total * 100),
    durationHours,
    durationLabel,
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
