import type { ListingDraft } from "./context";

// Builds a natural-language listing description from the structured draft
// fields. Deterministic and free — used to pre-fill an editable description box
// so hosts can keep it or tweak it. Keep the output to a few short sentences.

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Join a list with commas and a trailing "and": [a,b,c] -> "a, b and c". */
function joinList(items: string[]): string {
  const parts = items.filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Pick a human area/street from a comma-separated address, skipping bare numbers. */
function areaFromAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const meaningful = parts.find((p) => !/^\d+$/.test(p) && !/^d?\d{1,2}$/i.test(p));
  return meaningful ?? parts[0] ?? "";
}

export function generateListingDescription(draft: ListingDraft): string {
  const type = draft.spaceType?.trim() || "Parking";
  const area = areaFromAddress(draft.location?.address ?? "");
  const capacity = draft.capacity > 1 ? `${draft.capacity} cars` : "one car";

  const sentences: string[] = [];

  // 1. What and where.
  sentences.push(area ? `${type} parking in ${area}.` : `${type} parking space.`);

  // 2. Capacity + access features.
  const features = [
    ...(draft.accessOptions ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean),
    ...(draft.requiresAccessCode || draft.accessCode?.trim() ? ["gated code access"] : []),
  ];
  const featureText = features.length ? ` with ${joinList(features)}` : "";
  sentences.push(`${capitalize(`room for ${capacity}`)}${featureText}.`);

  // 3. Availability, if the host described it.
  const availability = draft.availability?.detail?.trim();
  if (availability) {
    sentences.push(`Available ${availability.replace(/\.$/, "")}.`);
  }

  // 4. Reassurance closing (matches the booking-flow trust notes).
  sentences.push("Exact location and arrival instructions are shared after you book.");

  return sentences.join(" ");
}
