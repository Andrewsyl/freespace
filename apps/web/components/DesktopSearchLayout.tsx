"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ListingCard, ListingCardSkeleton } from "./ListingCard";
import { SearchForm } from "./SearchForm";
import { MapView } from "./MapView";
import { FiltersPanel } from "./FiltersPanel";
import type { SharedLayoutProps } from "./searchLayoutTypes";
import type { Listing } from "./ListingCard";
import { SlimNav } from "./SlimNav";
import { SlidersHorizontal, X, ChevronLeft, ChevronRight, Clock, MapPin, Cctv, Zap, Home, Lock, Accessibility } from "lucide-react";
import { calculateListingTotal, formatPriceValue, getListingRateType } from "../lib/pricing";

export function DesktopSearchLayout({
  filters,
  results,
  status,
  error,
  center,
  selectedListingId,
  lockViewport,
  searchAsMove,
  pendingCenter,
  mapDirty,
  areaSearching,
  onSearch,
  onAddressChange,
  onSelectListing,
  onMarkerSelect,
  onMarkerClick,
  onBoundsChanged,
  onSearchArea,
  onSearchAsMove,
}: SharedLayoutProps) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [showListingOverlay, setShowListingOverlay] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [sortMode, setSortMode] = useState<"recommended" | "cheapest" | "closest">("recommended");
  const selectedListing = selectedListingId ? results.find((l) => l.id === selectedListingId) ?? null : null;
  const { start: searchStart, end: searchEnd } = useMemo(() => getSearchWindow(filters), [filters]);
  const checkoutHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("date", filters.date);
    params.set("startTime", filters.startTime);
    params.set("endDate", filters.endDate ?? filters.date);
    params.set("endTime", filters.endTime);
    if (filters.mode) params.set("mode", filters.mode);
    if (filters.monthlyPlan) params.set("monthlyPlan", filters.monthlyPlan);
    return (listingId: string) => `/checkout/${listingId}?${params.toString()}`;
  }, [filters.date, filters.endDate, filters.endTime, filters.mode, filters.monthlyPlan, filters.startTime]);
  const getSearchPrice = useMemo(
    () => (listing: Listing) => buildSearchPriceDisplay(listing, filters, searchStart, searchEnd),
    [filters, searchEnd, searchStart]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.radiusKm && filters.radiusKm !== 5) count += 1;
    if (filters.priceMin !== undefined) count += 1;
    if (filters.priceMax !== undefined) count += 1;
    if (filters.coveredParking) count += 1;
    if (filters.evCharging) count += 1;
    if (filters.securityLevel) count += 1;
    if (filters.vehicleSize) count += 1;
    if (filters.spaceType) count += 1;
    if (filters.instantBook) count += 1;
    if (filters.mode === "monthly") count += 1;
    return count;
  }, [filters]);

  useEffect(() => {
    if (!selectedListingId) setShowListingOverlay(false);
  }, [selectedListingId]);

  const listResults = useMemo(() => {
    if (sortMode === "cheapest") {
      return [...results].sort((a, b) => {
        return getSearchPrice(a).sortValue - getSearchPrice(b).sortValue;
      });
    }
    if (sortMode === "closest") return [...results].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    return results;
  }, [getSearchPrice, results, sortMode]);

  const SORT_TABS = [
    { key: "recommended", label: "Recommended" },
    { key: "cheapest",    label: "Cheapest" },
    { key: "closest",     label: "Closest" },
  ] as const;

  return (
    <div className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[#f8fafc]">
      <SlimNav />

      {/* ── Search strip ── */}
      <div className="border-b border-[#d9dde3] bg-[#f7f8fa] px-6 pb-3 pt-2 shadow-sm">
        <SearchForm
          initialValues={filters}
          onSearch={(f) => onSearch(f)}
          onOpenFilters={() => setShowFilters(true)}
          autoSearch
          onAddressChange={onAddressChange}
          variant="desktop-inline"
        />
      </div>

      {/* ── Three-column body ── */}
      <div className="flex min-h-0 flex-1 min-w-0 overflow-hidden pl-6">

        {/* ── Col 1: cards list (always visible) ── */}
        <div className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200 transition-[width] duration-300 ${
          mapUnavailable ? "w-[600px]" : "w-[520px]"
        }`}>
          <AnimatePresence mode="wait" initial={false}>
            {showFilters ? (
              <motion.div
                key="filters"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 28 }}
                transition={{ type: "spring", damping: 28, stiffness: 400, mass: 0.75 }}
                className="h-full overflow-y-auto px-4 py-4"
                style={{ scrollbarWidth: "thin" }}
              >
                <FiltersPanel
                  initialFilters={filters}
                  onApply={(next) => { onSearch(next, true); setShowFilters(false); }}
                  onCancel={() => setShowFilters(false)}
                  onLiveChange={(f) => onSearch(f)}
                  searchAsMove={searchAsMove}
                  onSearchAsMove={onSearchAsMove}
                />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", damping: 28, stiffness: 380, mass: 0.75 }}
                className="flex h-full flex-col overflow-hidden"
              >
                {/* Header */}
                <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4">
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {status === "loading" ? (
                        <div className="h-5 w-48 animate-pulse rounded-full bg-slate-100" />
                      ) : (
                        <h1 className="text-[15px] font-bold text-slate-900">
                          {results.length}{" "}
                          <span className="font-semibold text-slate-600">
                            {results.length === 1 ? "space" : "spaces"}
                            {filters.location ? ` near ${filters.location.split(",")[0]}` : ""}
                          </span>
                        </h1>
                      )}
                      <p className="mt-0.5 text-[11.5px] text-slate-600">
                        {filters.mode === "monthly"
                          ? `${filters.date} → ${filters.endDate ?? "30 days"}`
                          : `${filters.date} · ${filters.startTime}–${filters.endTime}`}
                        {formatRadiusLabel(filters.radiusKm) ? ` · within ${formatRadiusLabel(filters.radiusKm)}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFilters(true)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/80 p-0.5">
                    {SORT_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSortMode(tab.key)}
                        className={`flex-1 rounded-md py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                          sortMode === tab.key
                            ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.12)]"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scrollable cards */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "thin" }}>
                  {error && (
                    <div className="mb-3 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 shadow-sm" role="alert">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-rose-800">We could not load spaces.</p>
                        <p className="mt-0.5 text-[12.5px] text-rose-700">{error}</p>
                        <button
                          type="button"
                          onClick={() => onSearch(filters, true)}
                          className="mt-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    {status === "loading" ? (
                      Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} />)
                    ) : (
                      listResults.map((listing, idx) => (
                        <motion.div
                          key={listing.id}
                          initial={{ opacity: 0, x: -32 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: Math.min(idx * 0.055, 0.33),
                            type: "spring",
                            damping: 24,
                            stiffness: 320,
                          }}
                          onClick={() => { onSelectListing(listing); setShowListingOverlay(true); }}
                          className="cursor-pointer"
                        >
                          <ListingCard
                            listing={listing}
                            suppressNavigation
                            selected={selectedListingId === listing.id}
                            searchMode={filters.mode ?? "daily"}
                            priceDisplay={getSearchPrice(listing).card}
                          />
                        </motion.div>
                      ))
                    )}
                  </div>
                  {status !== "loading" && results.length === 0 && !error && (
                    <EmptyState
                      location={filters.location}
                      onAdjustFilters={() => setShowFilters(true)}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Col 2: map ── */}
        <motion.div
          className="relative h-full min-w-0 flex-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <MapView
            listings={results}
            priceMode={filters.mode ?? "daily"}
            priceForListing={(listing) => getSearchPrice(listing).sortValue}
            priceKey={`${filters.mode ?? "daily"}-${filters.date}-${filters.startTime}-${filters.endDate ?? filters.date}-${filters.endTime}`}
            center={center}
            initialZoom={16}
            maxZoom={17}
            minFitZoom={16}
            showCenterPin
            centerPinRadius={500}
            selectedListingId={selectedListingId ?? undefined}
            onSelectListing={onMarkerSelect}
            onMarkerClick={(listing) => { onMarkerClick(listing); setShowListingOverlay(true); }}
            disableAutoFit={lockViewport}
            onBoundsChanged={onBoundsChanged}
            onUnavailableChange={setMapUnavailable}
          />

          {/* Listing detail overlays the map instead of resizing it. */}
          <AnimatePresence initial={false}>
            {showListingOverlay && selectedListing && (
              <motion.div
                key={`panel-${selectedListing.id}`}
                initial={{ opacity: 0, x: -24, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -24, scale: 0.985 }}
                transition={{ type: "spring", damping: 28, stiffness: 340, mass: 0.85 }}
                className="absolute bottom-4 left-4 top-4 z-20 w-[480px] max-w-[calc(100%-32px)] overflow-hidden"
              >
                <ListingOverlay
                  listing={selectedListing}
                  filters={filters}
                  mode={filters.mode ?? "daily"}
                  pricing={getSearchPrice(selectedListing)}
                  onClose={() => setShowListingOverlay(false)}
                  onOpen={() => router.push(checkoutHref(selectedListing.id) as any)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters button */}
          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.14)] backdrop-blur-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {pendingCenter && mapDirty && !searchAsMove && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <button
                type="button"
                disabled={areaSearching}
                onClick={onSearchArea}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-[13px] font-semibold text-white shadow-lg backdrop-blur transition hover:bg-slate-900 disabled:opacity-60"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {areaSearching ? "Searching…" : "Search this area"}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  location,
  onAdjustFilters,
}: {
  location?: string;
  onAdjustFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      </div>
      <h3 className="text-[16px] font-bold text-slate-900">No spaces found</h3>
      <p className="mt-2 max-w-[250px] text-[13px] leading-relaxed text-slate-500">
        {location
          ? `We couldn't find any spaces near ${location}.`
          : "No spaces match your search."}
        {" "}Try widening your radius, changing the time, or removing a filter.
      </p>
      <button
        type="button"
        onClick={onAdjustFilters}
        className="mt-6 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
      >
        Adjust filters
      </button>
    </div>
  );
}

// ── Listing overlay ───────────────────────────────────────────────────────────

const SPACE_TYPE_MAP = [
  ["car park", "Car park"], ["carpark", "Car park"], ["garage", "Garage"],
  ["driveway", "Driveway"], ["private road", "Private road"],
  ["on-street", "On-street"], ["on street", "On-street"], ["underground", "Underground"],
] as const;

function deriveSpaceType(tags?: string[]): string | undefined {
  if (!tags?.length) return undefined;
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [key, label] of SPACE_TYPE_MAP) {
      if (lower.includes(key)) return label;
    }
  }
  return undefined;
}

/** Amber stars with half-star support. */
function StarRating({ rating }: { rating: number }) {
  const path = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
  return (
    <span className="flex items-center gap-[2px]">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = rating >= i + 1;
        const half   = !filled && rating > i;
        if (filled) return <svg key={i} className="h-[15px] w-[15px] fill-amber-400" viewBox="0 0 24 24"><path d={path}/></svg>;
        if (half)   return (
          <svg key={i} className="h-[15px] w-[15px]" viewBox="0 0 24 24">
            <defs>
              <linearGradient id={`hs${i}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="50%" stopColor="#fbbf24"/>
                <stop offset="50%" stopColor="#e2e8f0"/>
              </linearGradient>
            </defs>
            <path d={path} fill={`url(#hs${i})`}/>
          </svg>
        );
        return <svg key={i} className="h-[15px] w-[15px] fill-slate-200" viewBox="0 0 24 24"><path d={path}/></svg>;
      })}
    </span>
  );
}

/** "14:30" → "2:30pm" */
function formatTimeOnly(time: string): string {
  if (!time) return "";
  const [hStr = "0", mStr = "0"] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

/** "2026-05-27" → "today" | "tomorrow" | "Wed 28 May" */
function getRelativeDay(dateStr: string): string {
  if (!dateStr) return "";
  const target = new Date(`${dateStr}T12:00:00`);
  if (isNaN(target.getTime())) return dateStr;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diff = Math.round((startOfTarget - startOfToday) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return target.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
}


function ListingOverlay({
  listing,
  filters,
  mode,
  pricing,
  onClose,
  onOpen,
}: {
  listing: Listing;
  filters: SharedLayoutProps["filters"];
  mode: "daily" | "monthly";
  pricing: ReturnType<typeof buildSearchPriceDisplay>;
  onClose: () => void;
  onOpen: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const fallbackImage = listingGradient(listing);
  const isFallbackUrl = fallbackImage?.startsWith("http");
  const imageUrls = (listing.imageUrls ?? listing.image_urls ?? []).filter(Boolean);
  const allImages = imageUrls.length > 0 ? imageUrls : (isFallbackUrl ? [fallbackImage] : []);
  const currentImage = allImages[photoIndex] ?? null;
  const hasMultiplePhotos = allImages.length > 1;

  const streetViewUrl =
    typeof listing.latitude === "number" && typeof listing.longitude === "number"
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${listing.latitude},${listing.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`;

  const hasRating   = typeof listing.rating === "number" && listing.rating > 0;
  const features    = [...(listing.amenities ?? []), ...(listing.tags ?? [])];
  const feats       = (s: string) => features.some(f => f.toLowerCase().includes(s));
  const isInstant   = feats("instant");
  const hasCctv     = feats("cctv") || feats("camera");
  const hasEv       = feats("ev") || feats("charg");
  const hasGated    = feats("gat") || feats("barrier");
  const hasCovered  = feats("cover") || feats("shelter") || feats("roof");
  const hasDisabled = feats("disabled") || feats("wheelchair");
  const has247      = feats("24/7") || feats("24 hour");
  const spaceType   = deriveSpaceType(listing.tags);
  const isAvailable = listing.availability?.toLowerCase() !== "unavailable";
  const amenities   = [
    hasCovered  && { label: "Covered",     icon: "covered"  },
    hasGated    && { label: "Gated",       icon: "gated"    },
    hasCctv     && { label: "CCTV",        icon: "cctv"     },
    hasEv       && { label: "EV charging", icon: "ev"       },
    hasDisabled && { label: "Accessible",  icon: "disabled" },
    has247      && { label: "24/7 access", icon: "247"      },
  ].filter(Boolean) as { label: string; icon: string }[];
  const availabilityText = listing.availability?.trim() || "Available to book";

  const displayPrice = formatPriceValue(pricing.sortValue);

  // Duration label for daily mode
  const durationLabel = (() => {
    if (mode !== "daily") return null;
    const start = new Date(`${filters.date}T${filters.startTime}:00`);
    const end   = new Date(`${filters.endDate ?? filters.date}T${filters.endTime}:00`);
    const mins  = Math.round((end.getTime() - start.getTime()) / 60000);
    if (mins <= 0) return null;
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h} hour${h > 1 ? "s" : ""}` : `${m} min`;
  })();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">

      {/* ── Photo carousel ── */}
      <div className="relative h-52 w-full shrink-0 overflow-hidden bg-slate-100">
        {currentImage ? (
          <img
            key={currentImage}
            src={currentImage}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full" style={{ background: fallbackImage }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        {hasMultiplePhotos && (
          <>
            <button type="button" onClick={() => setPhotoIndex((i) => (i - 1 + allImages.length) % allImages.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70">
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <button type="button" onClick={() => setPhotoIndex((i) => (i + 1) % allImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70">
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {allImages.map((_, i) => (
                <button key={i} type="button" onClick={() => setPhotoIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === photoIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
              {photoIndex + 1}/{allImages.length}
            </span>
          </>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>

        {/* ── Title + rating + address ── */}
        <div className="px-4 pb-4 pt-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[17px] font-bold leading-snug tracking-tight text-slate-950">
              {listing.title}
            </h2>
            <div className="flex shrink-0 flex-wrap gap-1.5 pt-0.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
                {isAvailable ? "Available" : "Unavailable"}
              </span>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {hasRating && (
              <span className="flex items-center gap-1 text-[13px] font-semibold text-slate-700">
                <StarRating rating={listing.rating!} />
                {listing.rating!.toFixed(1)}
                <span className="font-normal text-slate-500">
                  ({listing.ratingCount} {(listing.ratingCount ?? 0) === 1 ? "review" : "reviews"})
                </span>
              </span>
            )}
            {spaceType && <span className="text-[12px] text-slate-400">·</span>}
            {spaceType && <span className="text-[12px] text-slate-600">{spaceType}</span>}
            {listing.distanceKm != null && (
              <>
                <span className="text-[12px] text-slate-400">·</span>
                <span className="text-[12px] text-slate-600">{listing.distanceKm.toFixed(1)} km away</span>
              </>
            )}
          </div>

          <div className="mt-2 flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
            <div>
              <p className="text-[12.5px] leading-relaxed text-slate-600">{listing.address}</p>
              <a href={streetViewUrl} target="_blank" rel="noreferrer"
                className="text-[12px] font-semibold text-brand-600 transition hover:text-brand-700">
                View on map →
              </a>
            </div>
          </div>
        </div>

        {/* ── Features — always visible, no accordion ── */}
        {amenities.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-900">Features</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {amenities.map(({ label, icon }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <AmenityIcon type={icon} />
                  </span>
                  <span className="text-[13px] text-slate-700">{label}</span>
                </div>
              ))}
              {isInstant && (
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 text-[14px]">
                    ⚡
                  </span>
                  <span className="text-[13px] text-slate-700">Instant book</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Access hours ── */}
        <div className="border-t border-slate-100 px-4 py-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-900">Access hours</p>
          <AvailabilityGrid listing={listing} availabilityText={availabilityText} compact />
        </div>

        {/* ── Booking summary + CTA ── */}
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                {mode === "daily" ? (
                  <>
                    <p className="text-[13.5px] font-bold text-slate-900">
                      {getRelativeDay(filters.date).charAt(0).toUpperCase() + getRelativeDay(filters.date).slice(1)},{" "}
                      {formatTimeOnly(filters.startTime)}–{formatTimeOnly(filters.endTime)}
                      {filters.endDate && filters.endDate !== filters.date && (
                        <span className="font-normal text-slate-500"> ({getRelativeDay(filters.endDate)})</span>
                      )}
                    </p>
                    {durationLabel && (
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-500">
                        <Clock className="h-3 w-3" strokeWidth={2} />
                        {durationLabel}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13.5px] font-bold text-slate-900">Monthly parking</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      From {formatOverlayDate(filters.date)} · {formatMonthlyPlan(filters.monthlyPlan)}
                    </p>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-[22px] font-extrabold leading-none tracking-tight text-slate-900">€{displayPrice}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {mode === "monthly" ? "per month" : "total"}
                </p>
              </div>
            </div>
          </div>

        <button
          onClick={() => {
            if (isAvailable) onOpen();
          }}
          disabled={!isAvailable}
          className={`mt-3 flex w-full items-center justify-center rounded-xl py-3.5 text-[15px] font-bold shadow-sm transition active:scale-[0.99] ${
            isAvailable
              ? "bg-brand-500 text-white hover:bg-brand-600"
              : "cursor-not-allowed bg-slate-200 text-slate-500"
          }`}
        >
          {isAvailable ? "Book this space" : "Unavailable for this time"}
        </button>
        <p className="mt-2.5 text-center text-[11.5px] text-slate-500">
          {isAvailable
            ? "Free cancellation up to 24 hours before arrival"
            : "Change your time or search area to find available spaces."}
        </p>
        </div>

        {/* ── Reviews ── */}
        {hasRating && (
          <div className="border-t border-slate-100 px-4 py-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-900">Reviews</p>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-[36px] font-extrabold leading-none text-slate-900">{listing.rating!.toFixed(1)}</p>
                <StarRating rating={listing.rating!} />
                <p className="mt-1 text-[11px] text-slate-500">
                  {listing.ratingCount} {(listing.ratingCount ?? 0) === 1 ? "review" : "reviews"}
                </p>
              </div>
              <div className="ml-2 flex-1 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-[12.5px] leading-relaxed text-slate-600">
                  Rated by drivers who have parked at this space.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Availability grid ─────────────────────────────────────────────────────────

const WEEKDAY_ORDER = [
  { label: "Monday",    dow: 1 },
  { label: "Tuesday",   dow: 2 },
  { label: "Wednesday", dow: 3 },
  { label: "Thursday",  dow: 4 },
  { label: "Friday",    dow: 5 },
  { label: "Saturday",  dow: 6 },
  { label: "Sunday",    dow: 0 },
];

function formatScheduleHour(iso: string): string {
  // The ISO value may be any date; we only care about the time portion.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-IE", { hour: "numeric", minute: "2-digit", hour12: true });
}

function AvailabilityGrid({
  listing,
  availabilityText,
  compact = false,
}: {
  listing: Listing;
  availabilityText: string;
  compact?: boolean;
}) {
  const schedule = listing.availabilitySchedule ?? null;
  const hasWeekly =
    Array.isArray(schedule) &&
    schedule.some((e) => e.kind === "open" && Array.isArray(e.repeatWeekdays) && e.repeatWeekdays.length > 0);
  const todayDow = new Date().getDay();

  if (hasWeekly && schedule) {
    const openEntries = schedule.filter((e) => e.kind === "open");
    const rows = WEEKDAY_ORDER.map(({ label, dow }) => {
      const entry = openEntries.find(
        (e) => Array.isArray(e.repeatWeekdays) && e.repeatWeekdays.includes(dow)
      );
      return {
        label,
        hours: entry
          ? `${formatScheduleHour(entry.startsAt)} – ${formatScheduleHour(entry.endsAt)}`
          : null,
        isToday: dow === todayDow,
      };
    });

    return (
      <div className={`divide-y divide-slate-100 ${compact ? "" : "px-4"}`}>
        {rows.map(({ label, hours, isToday }) => (
          <div
            key={label}
            className={`flex items-center justify-between py-2.5 ${isToday ? "font-semibold" : ""}`}
          >
            <span className={`text-[13px] ${isToday ? "text-slate-900" : "text-slate-600"}`}>
              {label}
              {isToday && (
                <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                  today
                </span>
              )}
            </span>
            {hours ? (
              <span className={`text-[13px] tabular-nums ${isToday ? "text-slate-900" : "text-slate-600"}`}>
                {hours}
              </span>
            ) : (
              <span className="text-[13px] text-slate-300">Closed</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Fallback: render the raw availability text
  return (
    <p className={`text-[13.5px] leading-6 text-slate-600 ${compact ? "" : "px-4 py-4"}`}>{availabilityText}</p>
  );
}

// ── Amenity icon ──────────────────────────────────────────────────────────────

function AmenityIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5 text-slate-500";
  if (type === "covered")  return <Home        className={cls} strokeWidth={2.1} />;
  if (type === "gated")    return <Lock        className={cls} strokeWidth={2.1} />;
  if (type === "cctv")     return <Cctv        className={cls} strokeWidth={2.1} />;
  if (type === "ev")       return <Zap         className={cls} strokeWidth={2.1} />;
  if (type === "disabled") return <Accessibility className={cls} strokeWidth={2.1} />;
  return                          <Clock       className={cls} strokeWidth={2.1} />;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function listingGradient(listing: Listing): string {
  const url = (listing as any).imageUrls?.[0] ?? listing.image;
  if (url) return url;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (key && typeof listing.latitude === "number" && typeof listing.longitude === "number") {
    return `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${listing.latitude},${listing.longitude}&key=${key}`;
  }
  const seed = listing.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `linear-gradient(135deg, hsl(${seed % 360},70%,55%), hsl(${(seed * 3) % 360},70%,45%))`;
}

function formatOverlayDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatOverlayDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time || "00:00"}:00`);
  if (Number.isNaN(parsed.getTime())) return `${date} ${time}`;
  return parsed.toLocaleString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMonthlyPlan(plan?: string) {
  if (plan === "weekdays") return "Mon - Fri only";
  if (plan === "any_3_days") return "Any 3 days";
  return "Everyday";
}


function getSearchWindow(filters: SharedLayoutProps["filters"]) {
  const start = new Date(`${filters.date}T${filters.startTime}:00`);
  const rawEnd = new Date(`${filters.endDate ?? filters.date}T${filters.endTime}:00`);
  const end =
    rawEnd.getTime() <= start.getTime() && !filters.endDate
      ? new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000)
      : rawEnd;
  return { start, end };
}

function formatRadiusLabel(radiusKm?: number) {
  if (typeof radiusKm !== "number" || !Number.isFinite(radiusKm) || radiusKm <= 0) return null;
  return `${radiusKm.toFixed(1).replace(/\.0$/, "")} km`;
}

function buildSearchPriceDisplay(
  listing: Listing,
  filters: SharedLayoutProps["filters"],
  start: Date,
  end: Date,
) {
  if (filters.mode === "monthly") {
    const value =
      typeof listing.pricePerMonth === "number" && listing.pricePerMonth > 0
        ? listing.pricePerMonth
        : listing.pricePerDay;
    return {
      sortValue: value,
      card: {
        eyebrow: "from",
        value,
        suffix: "per month",
      },
    };
  }

  const total = calculateListingTotal(listing, start, end);
  if (getListingRateType(listing) === "hourly") {
    return {
      sortValue: total.total,
      card: {
        eyebrow: "total",
        value: total.total,
        suffix: `for ${total.durationLabel}`,
      },
    };
  }

  return {
    sortValue: total.total,
    card: {
      eyebrow: "total",
      value: total.total,
      suffix: `for ${total.durationLabel}`,
    },
  };
}
