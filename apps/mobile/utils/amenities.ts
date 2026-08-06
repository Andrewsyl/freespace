// Turn raw amenity keys (e.g. "ev_charging", "cctv") into display labels
// ("EV Charging", "CCTV"): split on _/-, title-case words, keep known acronyms.
// Shared because the listing page and the booking summary both surface the same
// amenity set, and two formatters would render "CCTV" differently on each.
const AMENITY_ACRONYMS: Record<string, string> = { ev: "EV", cctv: "CCTV" };

export const humanizeAmenity = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      return AMENITY_ACRONYMS[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
