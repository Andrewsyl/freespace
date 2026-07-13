// Env must satisfy src/env.ts before the pricing module (which imports it) loads.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";

import { describe, expect, it } from "vitest";
import {
  grossFromParkingCents,
  monthlyGrossFromParkingCents,
  platformFeeCents,
  type PlatformFeeSchedule,
} from "../src/lib/pricing.js";

// The schedule that ships as env defaults — must reproduce the legacy
// hard-coded ×1.08 math bit-for-bit or every already-installed app 400s
// with "price out of date" on the next booking.
const LEGACY: PlatformFeeSchedule = { feeBps: 800, minFeeCents: 0, maxFeeCents: null };

describe("platform fee schedule", () => {
  it("default schedule is bit-exact with legacy Math.round(parking * 1.08)", () => {
    // Sweep values chosen to hit rounding boundaries (x.5 cents at 8%).
    const samples = [1, 3, 7, 13, 50, 99, 100, 101, 149, 250, 999, 1000, 1206, 4321, 9999, 14000, 123456];
    for (const parking of samples) {
      expect(grossFromParkingCents(parking, LEGACY)).toBe(Math.round(parking * 1.08));
    }
  });

  it("default monthly gross matches the legacy whole-euro rounding", () => {
    const samples = [1000, 9500, 12345, 14000, 15050, 20000, 99999];
    for (const parking of samples) {
      expect(monthlyGrossFromParkingCents(parking, LEGACY)).toBe(
        Math.round((parking * 1.08) / 100) * 100
      );
    }
  });

  it("charges no fee on zero or invalid parking amounts", () => {
    expect(platformFeeCents(0, LEGACY)).toBe(0);
    expect(platformFeeCents(-100, LEGACY)).toBe(0);
    expect(platformFeeCents(NaN, LEGACY)).toBe(0);
  });

  it("applies the minimum fee floor to small bookings only", () => {
    const withFloor: PlatformFeeSchedule = { feeBps: 800, minFeeCents: 49, maxFeeCents: null };
    // €2.00 parking: 8% = 16c → floored to 49c.
    expect(platformFeeCents(200, withFloor)).toBe(49);
    expect(grossFromParkingCents(200, withFloor)).toBe(249);
    // €10.00 parking: 8% = 80c → floor doesn't bind.
    expect(platformFeeCents(1000, withFloor)).toBe(80);
    expect(grossFromParkingCents(1000, withFloor)).toBe(1080);
    // Boundary: floor binds exactly up to parking = 612c (49c / 0.08 ≈ 612.5).
    expect(platformFeeCents(612, withFloor)).toBe(49);
    expect(platformFeeCents(613, withFloor)).toBe(49); // 8% of 613 = 49.04 → 49
    expect(platformFeeCents(619, withFloor)).toBe(50);
  });

  it("applies the maximum fee cap to large bookings only", () => {
    const withCap: PlatformFeeSchedule = { feeBps: 800, minFeeCents: 0, maxFeeCents: 999 };
    // €500 parking: 8% = €40 → capped at €9.99.
    expect(platformFeeCents(50000, withCap)).toBe(999);
    expect(grossFromParkingCents(50000, withCap)).toBe(50999);
    // €100 parking: 8% = €8 → cap doesn't bind.
    expect(platformFeeCents(10000, withCap)).toBe(800);
  });

  it("gross minus parking always equals the fee (host payout exactness)", () => {
    const schedules: PlatformFeeSchedule[] = [
      LEGACY,
      { feeBps: 800, minFeeCents: 49, maxFeeCents: null },
      { feeBps: 1200, minFeeCents: 49, maxFeeCents: 999 },
    ];
    for (const schedule of schedules) {
      for (const parking of [200, 612, 1000, 14000, 50000]) {
        const gross = grossFromParkingCents(parking, schedule);
        expect(gross - parking).toBe(platformFeeCents(parking, schedule));
      }
    }
  });

  it("monthly whole-euro rounding never reduces the host's parking amount below their set price minus 50c of rounding", () => {
    // The fee is derived as gross − parking by callers; the whole-euro rounding
    // moves the FEE, not the host payout. Verify the rounded gross stays within
    // 50c of the cent-level gross.
    const schedule: PlatformFeeSchedule = { feeBps: 800, minFeeCents: 49, maxFeeCents: null };
    for (const parking of [9500, 12345, 14000, 15050]) {
      const exact = grossFromParkingCents(parking, schedule);
      const rounded = monthlyGrossFromParkingCents(parking, schedule);
      expect(Math.abs(rounded - exact)).toBeLessThanOrEqual(50);
      expect(rounded % 100).toBe(0);
    }
  });
});
