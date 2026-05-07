import type { ListingDetail, ListingSummary } from "../types";

type ListingWithPricing = Pick<ListingSummary, "price_per_day" | "price_per_hour" | "rate_type">;

export function getListingRateType(listing: ListingWithPricing): "hourly" | "daily" {
  return listing.rate_type === "hourly" ? "hourly" : "daily";
}

export function getListingUnitPrice(listing: ListingWithPricing) {
  if (getListingRateType(listing) === "hourly") {
    return Number(listing.price_per_hour ?? 0);
  }
  return Number(listing.price_per_day ?? 0);
}

export function getListingPriceUnitLabel(listing: ListingWithPricing) {
  return getListingRateType(listing) === "hourly" ? "hr" : "day";
}

export function calculateListingTotal(listing: ListingWithPricing, start: Date, end: Date) {
  const ms = Math.max(0, end.getTime() - start.getTime());
  const durationHours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));

  if (getListingRateType(listing) === "hourly") {
    const total = Math.max(0, Math.round(getListingUnitPrice(listing) * durationHours));
    return {
      total,
      totalCents: total * 100,
      durationHours,
      durationLabel: `${durationHours} ${durationHours === 1 ? "hour" : "hours"}`,
    };
  }

  const billingDays = Math.max(1, Math.ceil(durationHours / 24));
  const total = Math.max(0, Math.round(getListingUnitPrice(listing) * billingDays));
  return {
    total,
    totalCents: total * 100,
    durationHours,
    durationLabel: `${billingDays} ${billingDays === 1 ? "day" : "days"}`,
  };
}

export function formatListingPriceLine(listing: ListingWithPricing) {
  return `€${getListingUnitPrice(listing)} / ${getListingPriceUnitLabel(listing)}`;
}

export type ListingPricingDetail = ListingDetail | ListingSummary;
