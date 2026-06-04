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

  if (dailyPrice != null && hourlyPrice != null) {
    const fullDays = Math.floor(durationHours / 24);
    const remainingHours = durationHours % 24;
    const remainingTotal =
      remainingHours > 0 ? Math.min(roundMoney(hourlyPrice * remainingHours), dailyPrice) : 0;
    total = fullDays * dailyPrice + remainingTotal;
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
  };
}

export function formatListingPriceLine(listing: ListingWithPricing) {
  return `€${getListingUnitPrice(listing)} / ${getListingUnitLabel(listing)}`;
}

export function formatPriceValue(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
