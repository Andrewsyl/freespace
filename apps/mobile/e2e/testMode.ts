import type { BookingSummary, AvailabilityEntry } from "../api";
import type { AuthUser } from "../auth";
import type { ListingDraft } from "../screens/listingFlow/context";
import type { ListingDetail, ListingSummary } from "../types";

export const mobileE2EEnabled = __DEV__;

type FlowStep =
  | "ListingLocation"
  | "ListingStreetView"
  | "ListingDetails"
  | "ListingFeaturesAccess"
  | "ListingAvailability"
  | "ListingPrice"
  | "ListingPhotos"
  | "ListingReview";

type RouteTarget =
  | {
      name: "Tabs";
      params?: {
        screen?: "Search" | "History" | "Profile";
        params?: Record<string, unknown>;
      };
    }
  | {
      name: "Listing";
      params: {
        id: string;
        from: string;
        to: string;
      };
    }
  | {
      name: "CreateListingFlow";
      params?: {
        listingId?: string;
      };
    };

type AuthSession = {
  token: string;
  refreshToken?: string | null;
  user: AuthUser;
};

type E2EScenarioState = {
  name: "guest-smoke" | "driver-booking" | "host-publish";
  authSession: AuthSession | null;
  route: RouteTarget;
  listing: ListingDetail;
  searchResults: ListingSummary[];
  bookings: BookingSummary[];
  hostBookings: BookingSummary[];
  hostListings: ListingSummary[];
  availability: AvailabilityEntry[];
  draft: ListingDraft | null;
  flowInitialRoute: FlowStep | null;
  mockedPaymentIntentId: string;
};

const fixtureFrom = "2026-06-02T09:00:00.000Z";
const fixtureTo = "2026-06-02T18:00:00.000Z";
const fixtureImage =
  "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80";

const fixtureListing: ListingDetail = {
  id: "e2e-listing-1",
  title: "Mountjoy Square secure parking",
  address: "Mountjoy Square, Dublin 1",
  price_per_day: 12,
  price_per_hour: 2.5,
  price_per_month: 110,
  rate_type: "daily",
  is_available: true,
  rating: 4.8,
  rating_count: 36,
  availability_text: "Available daily from 09:00 to 18:00",
  amenities: ["CCTV", "Covered", "Lighting"],
  latitude: 53.3579,
  longitude: -6.2552,
  image_urls: [fixtureImage],
  description:
    "Secure off-street parking close to the city centre with clear signage and easy access.",
  vehicle_size_suitability: "car",
  arrival_instructions: "Use the side gate and park in bay 4.",
  permission_declared: true,
  availabilitySchedule: [
    {
      id: "e2e-availability-1",
      kind: "open",
      startsAt: fixtureFrom,
      endsAt: fixtureTo,
      repeatWeekdays: [1, 2, 3, 4, 5],
      repeatUntil: null,
      createdAt: fixtureFrom,
    },
  ],
};

const fixtureSearchResult: ListingSummary = {
  id: fixtureListing.id,
  title: fixtureListing.title,
  address: fixtureListing.address,
  price_per_day: fixtureListing.price_per_day,
  price_per_hour: fixtureListing.price_per_hour,
  price_per_month: fixtureListing.price_per_month,
  rate_type: fixtureListing.rate_type,
  is_available: fixtureListing.is_available,
  rating: fixtureListing.rating,
  rating_count: fixtureListing.rating_count,
  availability_text: fixtureListing.availability_text,
  amenities: fixtureListing.amenities,
  latitude: fixtureListing.latitude,
  longitude: fixtureListing.longitude,
  image_urls: fixtureListing.image_urls,
  distance_m: 550,
};

const fixtureHostDraft: ListingDraft = {
  location: {
    address: "12 Smithfield Lane, Dublin 7",
    latitude: 53.3497,
    longitude: -6.2786,
  },
  coverHeading: null,
  coverPitch: null,
  spaceType: "Driveway",
  spaceCount: "1",
  vehicleSize: "car",
  accessOptions: ["CCTV", "Covered"],
  requiresAccessCode: false,
  accessCode: "",
  requiresArrivalInstructions: true,
  arrivalInstructions: "Enter through the black gate and use the left-side bay.",
  permissionDeclared: true,
  availability: {
    mode: "daily",
    detail: "Available every day, 24 hours",
    timeStart: "2026-06-01T00:00:00.000Z",
    timeEnd: "2026-06-01T23:59:00.000Z",
    dateStart: "2026-06-01T00:00:00.000Z",
    dateEnd: "2026-06-30T23:59:00.000Z",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    dayTimeRanges: {},
  },
  pricingMode: "both",
  rateType: "daily",
  pricePerDay: "12.00",
  pricePerHour: "2.50",
  pricePerMonth: "110.00",
  photos: [fixtureImage],
  capacity: 1,
};

const fixtureHostListing: ListingSummary = {
  id: "e2e-host-listing-1",
  title: "Smithfield Lane driveway",
  address: "12 Smithfield Lane, Dublin 7",
  price_per_day: 12,
  price_per_hour: 2.5,
  price_per_month: 110,
  rate_type: "daily",
  is_available: true,
  rating: 4.6,
  rating_count: 8,
  availability_text: "Available daily",
  amenities: ["CCTV", "Covered"],
  latitude: 53.3497,
  longitude: -6.2786,
  image_urls: [fixtureImage],
};

const fixtureHostBookings: BookingSummary[] = [
  {
    id: "e2e-host-booking-1",
    listingId: fixtureHostListing.id,
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    status: "confirmed",
    amountCents: 1000,
    currency: "eur",
    title: fixtureHostListing.title,
    address: fixtureHostListing.address,
    imageUrls: fixtureHostListing.image_urls ?? null,
    latitude: fixtureHostListing.latitude ?? null,
    longitude: fixtureHostListing.longitude ?? null,
    vehiclePlate: "191-D-45678",
    driverName: "Sarah Murphy",
    driverPhone: "+353 87 123 4567",
    driverVehicleMake: "Volkswagen",
    driverVehicleType: "Golf",
    driverVehicleColor: "Blue",
  },
  {
    id: "e2e-host-booking-2",
    listingId: fixtureHostListing.id,
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(),
    status: "confirmed",
    amountCents: 1000,
    currency: "eur",
    title: fixtureHostListing.title,
    address: fixtureHostListing.address,
    imageUrls: fixtureHostListing.image_urls ?? null,
    latitude: fixtureHostListing.latitude ?? null,
    longitude: fixtureHostListing.longitude ?? null,
    vehiclePlate: "231-G-99012",
    driverName: "Conor Walsh",
    driverPhone: "+353 86 987 6543",
    driverVehicleMake: "Toyota",
    driverVehicleType: "Corolla",
    driverVehicleColor: "Silver",
  },
];

const driverSession: AuthSession = {
  token: "e2e-driver-token",
  refreshToken: "e2e-driver-refresh",
  user: {
    id: "e2e-driver",
    email: "driver-e2e@freespace.ie",
    name: "Driver E2E",
    vehicleMake: "Toyota",
    vehicleType: "car",
    vehicleColor: "Silver",
    vehiclePlate: "251D12345",
    role: "driver",
    emailVerified: true,
    termsVersion: "2026-01",
    privacyVersion: "2026-01",
    authProvider: "password",
  },
};

const hostSession: AuthSession = {
  token: "e2e-host-token",
  refreshToken: "e2e-host-refresh",
  user: {
    id: "e2e-host",
    email: "host-e2e@freespace.ie",
    name: "Host E2E",
    role: "host",
    emailVerified: true,
    termsVersion: "2026-01",
    privacyVersion: "2026-01",
    authProvider: "password",
  },
};

function createScenario(name: E2EScenarioState["name"]): E2EScenarioState {
  switch (name) {
    case "driver-booking":
      return {
        name,
        authSession: driverSession,
        route: {
          name: "Listing",
          params: {
            id: fixtureListing.id,
            from: fixtureFrom,
            to: fixtureTo,
          },
        },
        listing: { ...fixtureListing },
        searchResults: [{ ...fixtureSearchResult }],
        bookings: [],
        hostBookings: [],
        hostListings: [],
        availability: fixtureListing.availabilitySchedule?.map((entry) => ({ ...entry })) ?? [],
        draft: null,
        flowInitialRoute: null,
        mockedPaymentIntentId: "e2e-payment-intent-1",
      };
    case "host-publish":
      return {
        name,
        authSession: hostSession,
        route: {
          name: "Tabs",
          params: { screen: "Profile" },
        },
        listing: { ...fixtureListing },
        searchResults: [],
        bookings: [],
        hostBookings: fixtureHostBookings.map((b) => ({ ...b })),
        hostListings: [{ ...fixtureHostListing }],
        availability: [],
        draft: {
          ...fixtureHostDraft,
          location: { ...fixtureHostDraft.location },
          availability: {
            ...fixtureHostDraft.availability,
            weekdays: [...fixtureHostDraft.availability.weekdays],
            dayTimeRanges: { ...(fixtureHostDraft.availability.dayTimeRanges ?? {}) },
          },
          accessOptions: [...fixtureHostDraft.accessOptions],
          photos: [...fixtureHostDraft.photos],
        },
        flowInitialRoute: "ListingReview",
        mockedPaymentIntentId: "e2e-payment-intent-2",
      };
    case "guest-smoke":
    default:
      return {
        name: "guest-smoke",
        authSession: null,
        route: {
          name: "Tabs",
          params: {
            screen: "Search",
          },
        },
        listing: { ...fixtureListing },
        searchResults: [{ ...fixtureSearchResult }],
        bookings: [],
        hostBookings: [],
        hostListings: [],
        availability: [],
        draft: null,
        flowInitialRoute: null,
        mockedPaymentIntentId: "e2e-payment-intent-3",
      };
  }
}

let activeScenario: E2EScenarioState | null = null;

export function isMobileE2EActive() {
  return mobileE2EEnabled && !!activeScenario;
}

export function configureMobileE2EScenario(name: string) {
  if (!mobileE2EEnabled) return null;
  const normalized =
    name === "driver-booking" || name === "host-publish" || name === "guest-smoke"
      ? name
      : "guest-smoke";
  activeScenario = createScenario(normalized);
  return activeScenario;
}

export function clearMobileE2EScenario() {
  activeScenario = null;
}

export function getMobileE2EState() {
  return activeScenario;
}

export function recordMockBooking() {
  if (!activeScenario) return null;
  const booking: BookingSummary = {
    id: "e2e-booking-1",
    listingId: activeScenario.listing.id,
    startTime: fixtureFrom,
    endTime: fixtureTo,
    status: "confirmed",
    amountCents: 1200,
    currency: "eur",
    title: activeScenario.listing.title,
    address: activeScenario.listing.address,
    imageUrls: activeScenario.listing.image_urls ?? null,
    latitude: activeScenario.listing.latitude ?? null,
    longitude: activeScenario.listing.longitude ?? null,
    vehiclePlate: driverSession.user.vehiclePlate ?? null,
    accessCode: null,
    arrivalInstructions: activeScenario.listing.arrival_instructions ?? null,
  };
  activeScenario.bookings = [booking];
  activeScenario.hostBookings = [];
  return booking;
}

export function recordMockListingPublish() {
  if (!activeScenario?.draft) return null;
  const summary: ListingSummary = {
    id: "e2e-host-listing-1",
    title: `${activeScenario.draft.spaceType} on ${activeScenario.draft.location.address}`,
    address: activeScenario.draft.location.address,
    price_per_day: Number(activeScenario.draft.pricePerDay) || 12,
    price_per_hour: Number(activeScenario.draft.pricePerHour) || 2.5,
    price_per_month: Number(activeScenario.draft.pricePerMonth) || 110,
    rate_type: activeScenario.draft.rateType,
    availability_text: activeScenario.draft.availability.detail,
    amenities: [...activeScenario.draft.accessOptions],
    latitude: activeScenario.draft.location.latitude,
    longitude: activeScenario.draft.location.longitude,
    image_urls: [...activeScenario.draft.photos],
  };
  activeScenario.hostListings = [summary];
  return summary.id;
}
