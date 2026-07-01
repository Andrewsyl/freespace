import type { HostListingDraft } from "./types";

export function prettySpaceType(value?: string) {
  switch (value) {
    // New labels (matching mobile)
    case "Private Driveway":
      return "Private Driveway";
    case "Garage":
      return "Garage";
    case "Car park":
      return "Car park";
    case "Private road":
      return "Private road";
    // Legacy IDs (backwards compat)
    case "driveway":
      return "Driveway";
    case "garage":
      return "Garage";
    case "carpark":
      return "Car park";
    case "street":
      return "Private road";
    default:
      return value ?? "Parking space";
  }
}

export function buildTitleFromDraft(draft: HostListingDraft) {
  const type = prettySpaceType(draft.spaceType);
  const city = draft.address?.split(",")?.[0]?.trim();
  if (city) return `${type} at ${city}`;
  return type;
}

/**
 * The Street View cover the host framed in step 2, rendered as a static image.
 * Returns null when there are no coords, the host skipped street view
 * (coverHeading === null), or no Maps key is configured.
 */
export function buildStreetViewCoverUrl(draft: HostListingDraft): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  if (draft.coverHeading === null) return null; // host skipped the angle step
  if (typeof draft.latitude !== "number" || typeof draft.longitude !== "number") return null;
  const heading = draft.coverHeading ?? 0;
  const pitch = draft.coverPitch ?? 0;
  return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${draft.latitude},${draft.longitude}&heading=${heading}&pitch=${pitch}&source=outdoor&key=${key}`;
}

/** A photo URL that came from the Street View static API (i.e. the framed cover). */
export function isStreetViewUrl(url: string): boolean {
  return url.includes("/maps/api/streetview");
}
