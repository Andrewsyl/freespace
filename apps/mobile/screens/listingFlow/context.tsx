import { createContext, useContext } from "react";

export type ListingDraft = {
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  coverHeading?: number | null;
  coverPitch?: number | null;
  // The panorama the host navigated to (e.g. by moving down the road), distinct
  // from `location` which stays fixed at the listing's address. Without this,
  // only heading/pitch were saved and the cover image always re-rendered at the
  // address's own panorama, discarding any movement.
  coverPanoId?: string | null;
  spaceType: string;
  spaceCount: string;
  vehicleSize: string;
  accessOptions: string[];
  requiresAccessCode: boolean | null;
  accessCode: string;
  requiresArrivalInstructions: boolean | null;
  arrivalInstructions: string;
  permissionDeclared: boolean;
  availability: {
    mode: "daily" | "dates" | "recurring";
    detail: string;
    timeStart: string;
    timeEnd: string;
    dateStart: string;
    dateEnd: string;
    weekdays: string[];
    dayTimeRanges?: Record<string, { start: string; end: string }>;
  };
  pricingMode: "hourly_daily" | "monthly" | "both";
  rateType: "hourly" | "daily";
  pricePerDay: string;
  pricePerHour: string;
  pricePerMonth: string;
  photos: string[];
  capacity: number;
  // Auto-generated from the fields above, but editable by the host.
  description: string;
};

export type ListingFlowValue = {
  draft: ListingDraft;
  setDraft: React.Dispatch<React.SetStateAction<ListingDraft>>;
  listingId: string | null;
};

export const ListingFlowContext = createContext<ListingFlowValue | null>(null);

export function useListingFlow() {
  const ctx = useContext(ListingFlowContext);
  if (!ctx) {
    throw new Error("useListingFlow must be used within ListingFlowContext");
  }
  return ctx;
}
