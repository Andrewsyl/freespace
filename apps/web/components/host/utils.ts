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
