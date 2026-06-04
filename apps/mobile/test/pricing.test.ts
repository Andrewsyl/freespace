import { calculateListingTotal } from "../utils/pricing";

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
});
