import {
  DEFAULT_PRICE_SUGGESTION_CONFIG,
  setPriceSuggestionConfig,
  suggestPrices,
} from "../utils/priceSuggestions";

// Module holds the active config in module state — restore defaults after
// tests that replace it so ordering never matters.
afterEach(() => {
  setPriceSuggestionConfig(DEFAULT_PRICE_SUGGESTION_CONFIG);
});

describe("suggestPrices — zone picking", () => {
  it("O'Connell Street lands in dublin-core", () => {
    const s = suggestPrices({ latitude: 53.3498, longitude: -6.2603 });
    expect(s).toEqual({ hourly: 2.5, daily: 14, monthly: 180, zone: "dublin-core" });
  });

  it("Dún Laoghaire (~10km out) lands in dublin-county, not a city-core zone", () => {
    const s = suggestPrices({ latitude: 53.2949, longitude: -6.1339 });
    expect(s.zone).toBe("dublin-county");
    expect(s).toMatchObject({ hourly: 1.5, daily: 8, monthly: 100 });
  });

  it("Cork city centre lands in cork-city", () => {
    const s = suggestPrices({ latitude: 51.8979, longitude: -8.4706 });
    expect(s.zone).toBe("cork-city");
    expect(s.monthly).toBe(110);
  });

  it("rural coordinates fall back to the national rates", () => {
    const s = suggestPrices({ latitude: 52.85, longitude: -6.93 });
    expect(s).toEqual({ hourly: 1, daily: 6, monthly: 70, zone: "fallback" });
  });

  it("missing/zeroed coordinates fall back instead of matching (0,0)-adjacent zones", () => {
    expect(suggestPrices({ latitude: 0, longitude: 0 }).zone).toBe("fallback");
    expect(suggestPrices({ latitude: NaN, longitude: NaN }).zone).toBe("fallback");
  });
});

describe("suggestPrices — feature bumps", () => {
  const core = { latitude: 53.3498, longitude: -6.2603 };

  it("EV charging bumps rates 15% with friendly rounding", () => {
    const s = suggestPrices({ ...core, features: ["EV charging"] });
    expect(s.hourly).toBe(2.9);   // 2.50 × 1.15 = 2.875 → 10c step
    expect(s.daily).toBe(16);     // 14 × 1.15 = 16.1 → 50c step
    expect(s.monthly).toBe(205);  // 180 × 1.15 = 207 → €5 step
  });

  it("Sheltered and Gated access count once, not twice", () => {
    const one = suggestPrices({ ...core, features: ["Sheltered"] });
    const both = suggestPrices({ ...core, features: ["Sheltered", "Gated access"] });
    expect(both).toEqual(one);
    expect(one.daily).toBe(15.5); // 14 × 1.1 = 15.4 → 50c step
  });

  it("EV and shelter bumps stack multiplicatively", () => {
    const s = suggestPrices({ ...core, features: ["EV charging", "Gated access"] });
    expect(s.hourly).toBe(3.2); // 2.50 × 1.15 × 1.1 = 3.1625 → 10c step
  });

  it("unknown features change nothing", () => {
    expect(suggestPrices({ ...core, features: ["CCTV", "Wide bay"] })).toEqual(
      suggestPrices(core)
    );
  });
});

describe("setPriceSuggestionConfig — server table validation", () => {
  const probe = { latitude: 53.3498, longitude: -6.2603 };

  it("applies a valid replacement table", () => {
    setPriceSuggestionConfig({
      zones: [{ name: "test-zone", lat: 53.3498, lng: -6.2603, radiusKm: 5, hourly: 9, daily: 90, monthly: 900 }],
      fallback: { hourly: 1, daily: 2, monthly: 3 },
    });
    expect(suggestPrices(probe)).toMatchObject({ zone: "test-zone", hourly: 9 });
  });

  it.each([
    ["empty zones", { zones: [], fallback: { hourly: 1, daily: 2, monthly: 3 } }],
    ["missing fallback", { zones: DEFAULT_PRICE_SUGGESTION_CONFIG.zones }],
    [
      "non-positive rate",
      {
        zones: [{ name: "z", lat: 53, lng: -6, radiusKm: 5, hourly: 0, daily: 2, monthly: 3 }],
        fallback: { hourly: 1, daily: 2, monthly: 3 },
      },
    ],
    [
      "zero radius",
      {
        zones: [{ name: "z", lat: 53, lng: -6, radiusKm: 0, hourly: 1, daily: 2, monthly: 3 }],
        fallback: { hourly: 1, daily: 2, monthly: 3 },
      },
    ],
  ])("rejects junk wholesale (%s) and keeps the previous table", (_label, junk) => {
    setPriceSuggestionConfig(junk as never);
    expect(suggestPrices(probe).zone).toBe("dublin-core");
  });

  it("ignores null/undefined (offline config fetch)", () => {
    setPriceSuggestionConfig(null);
    setPriceSuggestionConfig(undefined);
    expect(suggestPrices(probe).zone).toBe("dublin-core");
  });
});
