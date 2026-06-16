export type Country = {
  /** ISO 3166-1 alpha-2 code */
  code: string;
  name: string;
  /** International dial code, including leading + */
  dial: string;
};

/** Emoji flag derived from the ISO country code (no asset files needed). */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

// Ireland first (default), then the UK, then the rest alphabetically by name.
export const COUNTRIES: Country[] = [
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "AT", name: "Austria", dial: "+43" },
  { code: "BE", name: "Belgium", dial: "+32" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "BG", name: "Bulgaria", dial: "+359" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "HR", name: "Croatia", dial: "+385" },
  { code: "CY", name: "Cyprus", dial: "+357" },
  { code: "CZ", name: "Czechia", dial: "+420" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "EE", name: "Estonia", dial: "+372" },
  { code: "FI", name: "Finland", dial: "+358" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "GR", name: "Greece", dial: "+30" },
  { code: "HK", name: "Hong Kong", dial: "+852" },
  { code: "HU", name: "Hungary", dial: "+36" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "LV", name: "Latvia", dial: "+371" },
  { code: "LT", name: "Lithuania", dial: "+370" },
  { code: "LU", name: "Luxembourg", dial: "+352" },
  { code: "MT", name: "Malta", dial: "+356" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "RO", name: "Romania", dial: "+40" },
  { code: "SK", name: "Slovakia", dial: "+421" },
  { code: "SI", name: "Slovenia", dial: "+386" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
];

export const DEFAULT_COUNTRY: Country =
  COUNTRIES.find((c) => c.code === "IE") ?? COUNTRIES[0];

/**
 * Best-effort split of an E.164 number into a known country + national part.
 * Falls back to the default country with the digits as the national number.
 */
export function splitE164(input?: string | null): { country: Country; national: string } {
  const value = (input ?? "").trim();
  if (value.startsWith("+")) {
    // Match the longest dial code prefix.
    const match = [...COUNTRIES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => value.startsWith(c.dial));
    if (match) {
      return { country: match, national: value.slice(match.dial.length).replace(/\D/g, "") };
    }
  }
  return { country: DEFAULT_COUNTRY, national: value.replace(/\D/g, "") };
}

/** Build an E.164 number from a country and a locally-typed national number. */
export function toE164(country: Country, national: string): string {
  // Strip non-digits and a single leading 0 (common in IE/UK: 087… -> +35387…).
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  return `${country.dial}${digits}`;
}
