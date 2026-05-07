type ListingWithPricing = {
  pricePerDay: number;
  pricePerHour?: number | null;
  rateType?: "hourly" | "daily" | null;
};

export function getListingRateType(listing: ListingWithPricing) {
  return listing.rateType === "hourly" ? "hourly" : "daily";
}

export function getListingUnitPrice(listing: ListingWithPricing) {
  return getListingRateType(listing) === "hourly"
    ? Number(listing.pricePerHour ?? 0)
    : Number(listing.pricePerDay ?? 0);
}

export function getListingUnitLabel(listing: ListingWithPricing) {
  return getListingRateType(listing) === "hourly" ? "hr" : "day";
}

export function calculateListingTotal(listing: ListingWithPricing, start: Date, end: Date) {
  const durationHours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60)));
  if (getListingRateType(listing) === "hourly") {
    return {
      total: getListingUnitPrice(listing) * durationHours,
      durationLabel: `${durationHours} hour${durationHours === 1 ? "" : "s"}`,
      billingCount: durationHours,
      billingUnit: "hour",
    };
  }

  const billingDays = Math.max(1, Math.ceil(durationHours / 24));
  return {
    total: getListingUnitPrice(listing) * billingDays,
    durationLabel: `${billingDays} day${billingDays === 1 ? "" : "s"}`,
    billingCount: billingDays,
    billingUnit: "day",
  };
}

export function formatListingPriceLine(listing: ListingWithPricing) {
  return `€${getListingUnitPrice(listing)} / ${getListingUnitLabel(listing)}`;
}
