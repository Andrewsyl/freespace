type ListingWithPricing = {
  pricePerDay: number;
  pricePerHour?: number | null;
  pricePerMonth?: number | null;
  rateType?: "hourly" | "daily" | null;
};

const DEFAULT_DAILY_HOURS = 8;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getListingRateType(listing: ListingWithPricing) {
  if (typeof listing.pricePerHour === "number" && Number(listing.pricePerHour) > 0) {
    return "hourly";
  }
  return listing.rateType === "hourly" ? "hourly" : "daily";
}

export function getListingUnitPrice(listing: ListingWithPricing) {
  if (typeof listing.pricePerHour === "number" && Number(listing.pricePerHour) > 0) {
    return Number(listing.pricePerHour);
  }
  if (typeof listing.pricePerDay === "number" && Number(listing.pricePerDay) > 0) {
    return roundMoney(Number(listing.pricePerDay) / DEFAULT_DAILY_HOURS);
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
  if (durationHours < 24) {
    return {
      total: roundMoney(getListingUnitPrice(listing) * durationHours),
      durationLabel,
      billingCount: durationHours,
      billingUnit: "hour",
    };
  }

  const billingDays = Math.max(1, Math.ceil(durationHours / 24));
  return {
    total: roundMoney(getListingUnitPrice(listing) * billingDays),
    durationLabel,
    billingCount: billingDays,
    billingUnit: "day",
  };
}

export function formatListingPriceLine(listing: ListingWithPricing) {
  return `€${getListingUnitPrice(listing)} / ${getListingUnitLabel(listing)}`;
}

export function formatPriceValue(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
