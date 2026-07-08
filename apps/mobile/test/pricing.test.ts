import { applyServiceFee, calculateListingTotal } from "../utils/pricing";

describe("calculateListingTotal", () => {
  it("caps sub-day bookings at the daily rate when it is cheaper than hourly", () => {
    const listing = {
      price_per_day: 18,
      price_per_hour: 2,
      rate_type: "hourly" as const,
    };

    const start = new Date("2026-06-04T08:00:00.000Z");
    const end = new Date("2026-06-04T19:00:00.000Z");

    const result = calculateListingTotal(listing, start, end);
    expect(result.total).toBe(18);
    expect(result.dailyCapApplied).toBe(true);
    expect(result.dailyCapSaving).toBe(4); // 11hrs × €2 = €22, saved €4
    // Fee-inclusive saving — the single figure both the price bar and the
    // extend offer display, so they can never quote two different numbers.
    // €22 hourly gross (round(2200×1.08)=2376) − €18 capped gross
    // (round(1800×1.08)=1944) = €4.32.
    expect(result.dailyCapSavingGross).toBe(4.32);
    expect(result.dailyCapSavingGross).toBe(
      Math.round((applyServiceFee(result.total + result.dailyCapSaving) - result.grossTotal) * 100) / 100
    );
  });

  it("charges a full day plus remaining hours when a booking runs beyond 24 hours", () => {
    const listing = {
      price_per_day: 18,
      price_per_hour: 2,
      rate_type: "hourly" as const,
    };

    const start = new Date("2026-06-04T08:00:00.000Z");
    const end = new Date("2026-06-05T09:00:00.000Z");

    expect(calculateListingTotal(listing, start, end).total).toBe(20);
    expect(calculateListingTotal(listing, start, end).durationLabel).toBe("1d 1h");
  });

  // The quoted price and the charged price must be the same number: the API
  // charges round(parkingCents * 1.08), and every buyer-facing surface shows
  // grossTotal. If this breaks, the map quotes a price checkout won't honour.
  it("computes the fee-inclusive gross exactly like the API charge", () => {
    const listing = {
      price_per_day: 0,
      price_per_hour: 2.63,
      rate_type: "hourly" as const,
    };

    const start = new Date("2026-06-04T08:00:00.000Z");
    const end = new Date("2026-06-04T10:00:00.000Z");

    const result = calculateListingTotal(listing, start, end);
    expect(result.totalCents).toBe(526);
    expect(result.grossTotalCents).toBe(Math.round(526 * 1.08)); // 568
    expect(result.serviceFeeCents).toBe(42);
    expect(result.grossTotal).toBe(5.68);
  });

  it("applies the service fee to unit rates with API cent rounding", () => {
    expect(applyServiceFee(4)).toBe(4.32);
    expect(applyServiceFee(5.19)).toBe(5.61); // round(519 × 1.08) = 561, not 560
  });
});
