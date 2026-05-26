export type HostListingDraft = {
  address: string;
  latitude?: number;
  longitude?: number;
  locationConfirmed?: boolean;
  coverHeading?: number | null;
  coverPitch?: number | null;
  spaceType?: string;
  spaceCount?: string;
  vehicleSize?: string;
  title: string;
  availabilityText: string;
  requiresAccessCode?: boolean | null;
  accessType?: string;
  accessInstructions?: string;
  pricingMode?: "hourly_daily" | "monthly" | "both";
  pricePerHour?: number;
  pricePerDay?: number;
  pricePerMonth?: number;
  amenities: string[];
  imageUrls: string[];
};

export type HostStepProps = {
  data: HostListingDraft;
  onUpdate: (partial: Partial<HostListingDraft>) => void;
};
