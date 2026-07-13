import request from "supertest";
import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";

import { getPriceSuggestionConfig } from "../src/lib/priceSuggestions.js";

describe("price suggestion zone table", () => {
  const config = getPriceSuggestionConfig();

  it("every zone has positive rates and a positive radius", () => {
    for (const zone of config.zones) {
      expect(zone.radiusKm).toBeGreaterThan(0);
      expect(zone.hourly).toBeGreaterThan(0);
      expect(zone.daily).toBeGreaterThan(0);
      expect(zone.monthly).toBeGreaterThan(0);
      // Sanity ceiling — a fat-fingered table row (e.g. cents pasted as euro)
      // would otherwise prefill absurd prices on every new listing in a zone.
      expect(zone.monthly).toBeLessThan(1000);
      expect(zone.hourly).toBeLessThan(20);
    }
    expect(config.fallback.hourly).toBeGreaterThan(0);
    expect(config.fallback.daily).toBeGreaterThan(0);
    expect(config.fallback.monthly).toBeGreaterThan(0);
  });

  it("zones sharing a centre are ordered tightest-first (first match wins)", () => {
    const byCentre = new Map<string, number[]>();
    for (const zone of config.zones) {
      const key = `${zone.lat},${zone.lng}`;
      const radii = byCentre.get(key) ?? [];
      radii.push(zone.radiusKm);
      byCentre.set(key, radii);
    }
    for (const radii of byCentre.values()) {
      const sorted = [...radii].sort((a, b) => a - b);
      expect(radii).toEqual(sorted);
    }
  });

  it("is served by GET /api/config alongside the fee schedule", async () => {
    const { createApp } = await import("../src/app.js");
    const response = await request(createApp()).get("/api/config");
    expect(response.status).toBe(200);
    expect(response.body.priceSuggestions).toEqual(config);
    expect(response.body.pricing).toBeDefined();
  });
});
