import type { SearchFilters } from "./SearchForm";
import type { Listing } from "./ListingCard";

export type LatLngBoundsLiteral = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type SharedLayoutProps = {
  // Data
  filters: SearchFilters;
  results: Listing[];
  status: "idle" | "loading" | "error";
  error: string | null;
  center: { lat: number; lng: number };
  selectedListingId: string | null;
  popupListing: Listing | null;
  lockViewport: boolean;

  // Search-as-move / area state
  searchAsMove: boolean;
  pendingCenter: { lat: number; lng: number } | null;
  mapDirty: boolean;
  areaSearching: boolean;

  // Handlers
  onSearch: (f: SearchFilters, force?: boolean, opts?: { preserveViewport?: boolean }) => void;
  onAddressChange: (place: { address: string; lat: number; lng: number }) => void;
  onSelectListing: (listing: Listing) => void;
  onMarkerSelect: (id: string) => void;
  onMarkerClick: (listing: Listing) => void;
  onPopupBook: (listing: Listing) => void;
  onBoundsChanged: (
    bounds: LatLngBoundsLiteral,
    center: { lat: number; lng: number },
    zoom: number,
    userInteracted: boolean,
  ) => void;
  onSearchArea: () => void;
  onSearchAsMove: (v: boolean) => void;
};
