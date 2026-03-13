"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SearchFilters } from "../../../components/SearchForm";
import type { Listing } from "../../../components/ListingCard";
import type { LatLngBoundsLiteral } from "../../../components/searchLayoutTypes";
import { MobileSearchLayout } from "../../../components/MobileSearchLayout";
import { DesktopSearchLayout } from "../../../components/DesktopSearchLayout";
import { MobileSearchLanding } from "../../../components/MobileSearchLanding";
import { useIsMobile } from "../../../lib/useBreakpoint";
import { searchSpaces } from "../../../lib/api";

// ── Defaults ─────────────────────────────────────────────────────────────────

const defaultFilters: SearchFilters = {
  location: "Dublin City Centre",
  date: new Date().toISOString().split("T")[0],
  startTime: "09:00",
  endTime: "18:00",
  radiusKm: 5,
  latitude: 53.3498,
  longitude: -6.2603,
  mode: "daily",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.sqrt(h));
};

const radiusFromBounds = (bounds: LatLngBoundsLiteral, center: { lat: number; lng: number }) => {
  const corners = [
    { lat: bounds.north, lng: bounds.east },
    { lat: bounds.north, lng: bounds.west },
    { lat: bounds.south, lng: bounds.east },
    { lat: bounds.south, lng: bounds.west },
  ];
  return Math.max(0.05, Number(Math.max(...corners.map((c) => haversineKm(center, c))).toFixed(2)));
};

// ── Page entry point ──────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchPageContainer />
    </Suspense>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>
  );
}

// ── Container — owns all state and handlers ───────────────────────────────────

function SearchPageContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isMobile = useIsMobile();

  // ── URL-derived initial filters ──
  const initialFromUrl = useMemo(() => {
    const get = (k: string) => searchParams.get(k);
    return {
      location: get("location") ?? undefined,
      date: get("date") ?? undefined,
      endDate: get("endDate") ?? undefined,
      startTime: get("startTime") ?? undefined,
      endTime: get("endTime") ?? undefined,
      radiusKm: get("radiusKm") ? Number(get("radiusKm")) : undefined,
      latitude: get("lat") ? Number(get("lat")) : undefined,
      longitude: get("lng") ? Number(get("lng")) : undefined,
      mode: (get("mode") as SearchFilters["mode"]) ?? undefined,
      priceMin: get("priceMin") ? Number(get("priceMin")) : undefined,
      priceMax: get("priceMax") ? Number(get("priceMax")) : undefined,
      coveredParking: get("coveredParking") === "true" ? true : undefined,
      evCharging: get("evCharging") === "true" ? true : undefined,
      securityLevel: (get("securityLevel") as SearchFilters["securityLevel"]) ?? undefined,
      vehicleSize: (get("vehicleSize") as SearchFilters["vehicleSize"]) ?? undefined,
      instantBook: get("instantBook") === "true" ? true : undefined,
    } as Partial<SearchFilters>;
  }, [searchParams]);

  // ── Core state ──
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [results, setResults] = useState<Listing[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [popupListingId, setPopupListingId] = useState<string | null>(null);

  // On mobile: start on the landing form unless the URL already has search params
  const hasUrlParams = !!(searchParams.get("lat") || searchParams.get("location"));
  const [mobilePhase, setMobilePhase] = useState<"landing" | "map">(
    hasUrlParams ? "map" : "landing",
  );

  // ── Search-as-move state ──
  const [searchAsMove, setSearchAsMove] = useState(false);
  const [pendingCenter, setPendingCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingBounds, setPendingBounds] = useState<LatLngBoundsLiteral | null>(null);
  const [mapDirty, setMapDirty] = useState(false);
  const [preserveViewport, setPreserveViewport] = useState(false);
  const [areaSearching, setAreaSearching] = useState(false);

  const lastSearchRef = useRef<string>("");
  const lastAppliedCenter = useRef<{ lat: number; lng: number } | null>(null);
  const ignoreInitialBounds = useRef(true);
  const initialized = useRef(false);

  // Reset ignoreInitialBounds when the active layout changes (MapView remounts)
  useEffect(() => {
    if (isMobile !== null) ignoreInitialBounds.current = true;
  }, [isMobile]);

  // ── Initialise from URL on first render ──
  useEffect(() => {
    const merged: SearchFilters = {
      ...defaultFilters,
      ...initialFromUrl,
      latitude: initialFromUrl.latitude ?? defaultFilters.latitude,
      longitude: initialFromUrl.longitude ?? defaultFilters.longitude,
      radiusKm: initialFromUrl.radiusKm ?? defaultFilters.radiusKm,
      date: initialFromUrl.date ?? defaultFilters.date,
      startTime: initialFromUrl.startTime ?? defaultFilters.startTime,
      endTime: initialFromUrl.endTime ?? defaultFilters.endTime,
    };
    if (!initialized.current) {
      initialized.current = true;
      setFilters(merged);
      if (merged.latitude && merged.longitude) {
        lastAppliedCenter.current = { lat: merged.latitude, lng: merged.longitude };
      }
      // On mobile, don't auto-search — wait for the landing form submission
      if (!isMobile || hasUrlParams) {
        void runSearch(merged, true);
      }
    } else {
      setFilters(merged);
    }
  }, [initialFromUrl]);

  // ── Search function ──
  const runSearch = async (
    next: SearchFilters,
    force = false,
    opts?: { preserveViewport?: boolean },
  ) => {
    const preserve = !!opts?.preserveViewport;
    const sig = JSON.stringify(next);
    if (sig === lastSearchRef.current && !force) return;
    lastSearchRef.current = sig;

    setPreserveViewport(preserve);
    if (preserve) setAreaSearching(true);
    setStatus("loading");
    setError(null);
    setFilters(next);

    // Sync URL
    const p = new URLSearchParams();
    p.set("location", next.location);
    p.set("date", next.date);
    p.set("startTime", next.startTime);
    p.set("endTime", next.endTime);
    p.set("radiusKm", String(next.radiusKm));
    if (next.mode) p.set("mode", next.mode);
    if (next.endDate) p.set("endDate", next.endDate);
    if (next.latitude !== undefined) p.set("lat", String(next.latitude));
    if (next.longitude !== undefined) p.set("lng", String(next.longitude));
    if (next.priceMin !== undefined) p.set("priceMin", String(next.priceMin));
    if (next.priceMax !== undefined) p.set("priceMax", String(next.priceMax));
    if (next.coveredParking) p.set("coveredParking", "true");
    if (next.evCharging) p.set("evCharging", "true");
    if (next.securityLevel) p.set("securityLevel", next.securityLevel);
    if (next.vehicleSize) p.set("vehicleSize", next.vehicleSize);
    if (next.instantBook) p.set("instantBook", "true");
    if (p.toString() !== searchParams.toString()) {
      router.replace(`/search?${p.toString()}`);
    }

    try {
      const data = await searchSpaces(next);
      setResults(data);
      setStatus("idle");
      if (next.latitude !== undefined && next.longitude !== undefined) {
        lastAppliedCenter.current = { lat: next.latitude, lng: next.longitude };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setStatus("error");
    } finally {
      if (preserve) setAreaSearching(false);
    }
  };

  const center = useMemo(
    () => ({ lat: filters.latitude ?? 53.3498, lng: filters.longitude ?? -6.2603 }),
    [filters.latitude, filters.longitude],
  );

  const lockViewport = preserveViewport || searchAsMove || mapDirty;

  // ── Listing selection handlers ──
  const handleSelectListing = useCallback((listing: Listing) => {
    setSelectedListingId(listing.id);
    setPopupListingId(null);
  }, []);

  const handleMarkerSelect = useCallback((id: string) => {
    setSelectedListingId(id);
  }, []);

  const handleMarkerClick = useCallback((listing: Listing) => {
    setSelectedListingId(listing.id);
    setPopupListingId(listing.id);
  }, []);

  const handlePopupBook = useCallback(
    (listing: Listing) => router.push(`/listing/${listing.id}`),
    [router],
  );

  // ── Bounds change — single handler for whichever MapView is mounted ──
  const handleBoundsChanged = useCallback(
    (b: LatLngBoundsLiteral, c: { lat: number; lng: number }, _z: number, userInteracted: boolean) => {
      if (ignoreInitialBounds.current) {
        ignoreInitialBounds.current = false;
        lastAppliedCenter.current = { lat: c.lat, lng: c.lng };
        return;
      }
      if (!userInteracted) return;
      const last = lastAppliedCenter.current;
      const curr = { lat: filters.latitude ?? 0, lng: filters.longitude ?? 0 };
      const delta = (a: typeof c, b2: typeof c) => Math.sqrt((a.lat - b2.lat) ** 2 + (a.lng - b2.lng) ** 2);
      const movedMeaningfully = (!last || delta(last, c) > 0.003) && delta(curr, c) > 0.003;
      if (!movedMeaningfully) return;

      if (searchAsMove) {
        const radiusKm = radiusFromBounds(b, c);
        const updated = { ...filters, latitude: c.lat, longitude: c.lng, radiusKm };
        void runSearch(updated, true, { preserveViewport: true });
        lastAppliedCenter.current = c;
        setPendingCenter(null);
        setPendingBounds(null);
        setMapDirty(false);
      } else {
        setPendingCenter(c);
        setPendingBounds(b);
        setMapDirty(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, searchAsMove],
  );

  const handleSearchArea = useCallback(() => {
    if (!pendingCenter) return;
    const radiusKm = pendingBounds ? radiusFromBounds(pendingBounds, pendingCenter) : filters.radiusKm;
    const updated = { ...filters, latitude: pendingCenter.lat, longitude: pendingCenter.lng, radiusKm };
    void runSearch(updated, true, { preserveViewport: true });
    lastAppliedCenter.current = pendingCenter;
    setPendingCenter(null);
    setPendingBounds(null);
    setMapDirty(false);
  }, [pendingCenter, pendingBounds, filters]);

  const handleAddressChange = useCallback(
    (place: { address: string; lat: number; lng: number }) => {
      setFilters((prev) => ({ ...prev, location: place.address, latitude: place.lat, longitude: place.lng }));
    },
    [],
  );

  const popupListing = popupListingId ? results.find((l) => l.id === popupListingId) ?? null : null;

  const sharedProps = {
    filters,
    results,
    status,
    error,
    center,
    selectedListingId,
    popupListing,
    lockViewport,
    searchAsMove,
    pendingCenter,
    mapDirty,
    areaSearching,
    onSearch: runSearch,
    onAddressChange: handleAddressChange,
    onSelectListing: handleSelectListing,
    onMarkerSelect: handleMarkerSelect,
    onMarkerClick: handleMarkerClick,
    onPopupBook: handlePopupBook,
    onBoundsChanged: handleBoundsChanged,
    onSearchArea: handleSearchArea,
    onSearchAsMove: setSearchAsMove,
  } as const;

  // ── Render ──
  if (isMobile === null) return <SearchSkeleton />;
  if (isMobile && mobilePhase === "landing") {
    return (
      <MobileSearchLanding
        initialFilters={filters}
        onSearch={(f) => {
          setMobilePhase("map");
          void runSearch(f, true);
        }}
      />
    );
  }
  if (isMobile) return <MobileSearchLayout {...sharedProps} />;
  return <DesktopSearchLayout {...sharedProps} />;
}
