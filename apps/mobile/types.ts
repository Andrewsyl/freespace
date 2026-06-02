export type RootStackParamList = {
  Tabs:
    | {
        screen?: "Search" | "History" | "Profile";
        params?: Record<string, unknown>;
      }
    | undefined;
  Search: { hideTabBar?: boolean } | undefined;
  Listing: {
    id: string;
    from: string;
    to: string;
    booking?: import("./api").BookingSummary;
  };
  ListingReviews: {
    id: string;
    rating?: number | null;
    ratingCount?: number | null;
  };
  BookingSummary: {
    id: string;
    from: string;
    to: string;
  };
  VehicleType:
    | {
        returnTo?: "BookingSummary";
        focusField?: "plate";
      }
    | undefined;
  Welcome: { returnTo?: AuthReturnTo } | undefined;
  SignIn: { returnTo?: AuthReturnTo } | undefined;
  Register: { returnTo?: AuthReturnTo } | undefined;
  ResetPassword:
    | {
        token?: string;
        apiBase?: string;
      }
    | undefined;
  Profile: { hideTabBar?: boolean } | undefined;
  PersonalInfo: undefined;
  LoginSecurity: undefined;
  Legal: undefined;
  History: { showSuccess?: boolean; refreshToken?: number; showMapCTA?: boolean; initialTab?: "upcoming" | "active" | "past" } | undefined;
  Settings: undefined;
  Listings: undefined;
  Payments: undefined;
  Favorites: undefined;
  Support:
    | {
        prefillSubject?: string;
        prefillMessage?: string;
      }
    | undefined;
  Admin: undefined;
  BookingDetail: {
    booking: import("./api").BookingSummary;
  };
  Review: {
    booking: import("./api").BookingSummary;
    initialRating?: number;
  };
  CreateListingFlow: {
    listingId?: string;
  } | undefined;
  EditListing: {
    id: string;
  };
};

export type AuthReturnTo =
  | { screen: "Listing"; params: { id: string; from: string; to: string } }
  | { screen: "BookingSummary"; params: { id: string; from: string; to: string } };

export type ListingSummary = {
  id: string;
  title: string;
  address: string;
  price_per_day: number;
  price_per_hour?: number | null;
  price_per_month?: number | null;
  rate_type?: "hourly" | "daily" | null;
  is_available?: boolean | null;
  rating?: number | null;
  rating_count?: number | null;
  availability_text?: string | null;
  amenities?: string[] | null;
  access_code?: string | null;
  accessCode?: string | null;
  arrival_instructions?: string | null;
  arrivalInstructions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_m?: number | null;
  image_urls?: string[] | null;
  imageUrls?: string[] | null;
  capacity?: number | null;
};

export type ListingDetail = ListingSummary & {
  image_urls?: string[] | null;
  amenities?: string[] | null;
  access_code?: string | null;
  accessCode?: string | null;
  arrival_instructions?: string | null;
  arrivalInstructions?: string | null;
  is_available?: boolean | null;
  permission_declared?: boolean | null;
  permissionDeclared?: boolean | null;
  description?: string | null;
  vehicle_size_suitability?: string | null;
  vehicleSizeSuitability?: string | null;
  access_directions?: string | null;
  accessDirections?: string | null;
  availabilitySchedule?: {
    id: string;
    kind: "open" | "blocked";
    startsAt: string;
    endsAt: string;
    repeatWeekdays?: number[] | null;
    repeatUntil?: string | null;
    createdAt: string;
  }[];
};

export type SecurityLevel = "basic" | "gated" | "cctv";
export type VehicleSize = "motorcycle" | "car" | "van";

export type SearchParams = {
  lat: string;
  lng: string;
  radiusKm: string;
  from: string;
  to: string;
  includeUnavailable?: boolean;
  spaceType?: string;
  priceMin?: string;
  priceMax?: string;
  coveredParking?: boolean;
  evCharging?: boolean;
  securityLevel?: SecurityLevel;
  vehicleSize?: VehicleSize;
  instantBook?: boolean;
};
