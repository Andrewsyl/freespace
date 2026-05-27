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
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
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
  const [sortMode, setSortMode] = useState<"recommended" | "cheapest" | "closest">("recommended");
  const selectedListing = selectedListingId ? results.find((l) => l.id === selectedListingId) ?? null : null;
  const { start: searchStart, end: searchEnd } = useMemo(() => getSearchWindow(filters), [filters]);
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
      <div className="border-b border-[#d9dde3] bg-[#f7f8fa] px-3 pb-3 pt-2 shadow-sm">
        <SearchForm
          initialValues={filters}
          onSearch={(f) => onSearch(f)}
          onOpenFilters={() => setShowFilters(true)}
          autoSearch
          onAddressChange={onAddressChange}
          variant="desktop-inline"
        />
      </div>

      {/* ── Two-column body ── */}
      <div className="grid min-h-0 flex-1 min-w-0 grid-cols-[460px,1fr] gap-0 overflow-hidden pl-6 pr-0 pb-0 pt-0">

        {/* Left sidebar */}
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>

              {showFilters ? (
                <motion.div
                  key="filters"
                  initial={{ opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 28 }}
                  transition={{ type: "spring", damping: 28, stiffness: 400, mass: 0.75 }}
                  className="h-full overflow-y-auto pr-1"
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

              ) : showListingOverlay && selectedListing ? (
                <motion.div
                  key={`overlay-${selectedListing.id}`}
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  transition={{ type: "spring", damping: 24, stiffness: 380, mass: 0.8 }}
                  className="h-full pt-4 pr-4"
                >
                  <ListingOverlay
                    listing={selectedListing}
                    filters={filters}
                    mode={filters.mode ?? "daily"}
                    pricing={getSearchPrice(selectedListing)}
                    onClose={() => setShowListingOverlay(false)}
                    onOpen={() => router.push(`/listing/${selectedListing.id}`)}
                  />
                </motion.div>

              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", damping: 28, stiffness: 380, mass: 0.75 }}
                  className="h-full overflow-y-auto space-y-3 pb-4 pr-4 pt-4"
                >
                  {/* Header */}
                  <div className="border-b border-slate-100 pb-3 pt-0.5">
                    {/* Result count */}
                    <div className="mb-2.5">
                      {status === "loading" ? (
                        <div className="h-5 w-48 animate-pulse rounded-full bg-slate-100" />
                      ) : (
                        <h1 className="text-[15px] font-bold text-slate-900">
                          {results.length}{" "}
                          <span className="font-semibold text-slate-500">
                            {results.length === 1 ? "space" : "spaces"}
                            {filters.location ? ` near ${filters.location.split(",")[0]}` : ""}
                          </span>
                        </h1>
                      )}
                      <p className="mt-0.5 text-[11.5px] text-slate-400">
                        {filters.mode === "monthly"
                          ? `${filters.date} → ${filters.endDate ?? "30 days"}`
                          : `${filters.date} · ${filters.startTime}–${filters.endTime}`}
                      </p>
                    </div>

                    {/* Sort tabs — full width */}
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                      {SORT_TABS.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setSortMode(tab.key)}
                          className={`flex-1 rounded-md py-1.5 text-[12px] font-semibold transition ${
                            sortMode === tab.key
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm text-rose-700">{error}</p>
                    </div>
                  )}

                  {/* Cards */}
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

                  {/* Empty state */}
                  {status !== "loading" && results.length === 0 && !error && (
                    <EmptyState location={filters.location} />
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* Map */}
        <motion.div
          className="h-full min-w-0 border-l border-slate-200"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="relative h-full overflow-hidden">
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
            />

            {/* Filters button — top-left of map */}
            <div className="pointer-events-none absolute left-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setShowFilters((s) => !s)}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.14)] backdrop-blur-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#20a73f] px-1 text-[10px] font-bold text-white">
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
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ location }: { location?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100">
        <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      </div>
      <h3 className="text-[15px] font-semibold text-slate-800">No spaces found</h3>
      <p className="mt-1.5 max-w-[220px] text-[13px] leading-relaxed text-slate-500">
        {location
          ? `We couldn't find any spaces near ${location}.`
          : "No spaces match your search."}
        {" "}Try adjusting your dates, times or search radius.
      </p>
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

type OverlayTab = "overview" | "reviews" | "availability";

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
  const [activeTab, setActiveTab] = useState<OverlayTab>("overview");

  const image = listingGradient(listing);
  const isUrl = image?.startsWith("http");
  const imageUrls = (listing.imageUrls ?? listing.image_urls ?? []).filter(Boolean);
  const primaryImage   = imageUrls[0] ?? null;
  const secondaryImage = imageUrls[1] ?? imageUrls[0] ?? null;
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
  const summary = buildOverlaySummary(listing, {
    amenities: amenities.map((a) => a.label),
    spaceType,
    availabilityText,
  });

  const displayPrice = formatPriceValue(pricing.sortValue);

  const TABS: { key: OverlayTab; label: string }[] = [
    { key: "overview",     label: "Overview"     },
    { key: "reviews",      label: "Reviews"      },
    { key: "availability", label: "Availability" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-100 px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 line-clamp-1 text-[17px] font-bold leading-tight tracking-tight text-slate-950">
            {listing.title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {hasRating && (
              <div className="flex items-center gap-1">
                <StarRating rating={listing.rating!} />
                <span className="text-[12.5px] font-bold text-slate-900">{listing.rating!.toFixed(2)}</span>
                {(listing.ratingCount ?? 0) > 0 && (
                  <span className="text-[12px] text-slate-400">({listing.ratingCount})</span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close space details"
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Badges + meta */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {spaceType && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {spaceType}
            </span>
          )}
          {isInstant && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">
              Instant book
            </span>
          )}
          {listing.distanceKm != null && (
            <span className="text-[11.5px] text-slate-400">{listing.distanceKm.toFixed(1)} km away</span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
            isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
            {isAvailable ? "Available" : "Unavailable"}
          </span>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>

        {/* Booking summary */}
        <div className="border-b border-slate-100 px-4 py-4">
          {mode === "daily" ? (
            <div className="flex items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-brand-600">Enter after</p>
                <p className="mt-0.5 text-[17px] font-bold leading-tight text-slate-900">
                  {formatTimeOnly(filters.startTime)}
                  <span className="ml-1 text-[12px] font-normal text-slate-400">
                    ({getRelativeDay(filters.date)})
                  </span>
                </p>
              </div>
              <div className="mx-2 shrink-0 text-brand-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-brand-600">Exit before</p>
                <p className="mt-0.5 text-[17px] font-bold leading-tight text-slate-900">
                  {formatTimeOnly(filters.endTime)}
                  <span className="ml-1 text-[12px] font-normal text-slate-400">
                    ({getRelativeDay(filters.endDate ?? filters.date)})
                  </span>
                </p>
              </div>
              <div className="ml-3 shrink-0 border-l border-slate-200 pl-3">
                <p className="text-[11px] font-semibold text-slate-400">Price</p>
                <p className="mt-0.5 text-[17px] font-bold leading-tight text-slate-900">€{displayPrice}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-brand-600">Start</p>
                <p className="mt-0.5 text-[15px] font-bold text-slate-900">{formatOverlayDate(filters.date)}</p>
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-brand-600">Plan</p>
                <p className="mt-0.5 text-[15px] font-bold text-slate-900">{formatMonthlyPlan(filters.monthlyPlan)}</p>
              </div>
              <div className="shrink-0 border-l border-slate-200 pl-3">
                <p className="text-[11px] font-semibold text-slate-400">Price</p>
                <p className="mt-0.5 text-[17px] font-bold text-slate-900">€{displayPrice}</p>
              </div>
            </div>
          )}
        </div>

        {/* Book now CTA + tabs — grouped with no gap between them */}
        <div className="border-b border-slate-100 px-4 pt-3 pb-0">
          <button
            onClick={onOpen}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-3 text-[14px] font-bold text-white transition hover:bg-brand-600 active:scale-[0.99]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd"/>
            </svg>
            Book now securely
          </button>

          {/* Tabs sit directly below the button */}
          <div className="mt-3 flex border-t border-slate-100">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 text-[12.5px] font-semibold transition ${
                  i < TABS.length - 1 ? "border-r border-slate-100" : ""
                } ${
                  activeTab === tab.key
                    ? "border-b-2 border-b-slate-900 text-slate-900"
                    : "border-b-2 border-b-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Overview tab ── */}
        {activeTab === "overview" && (
          <div className="space-y-4 px-4 py-4">
            {/* Photos */}
            <div className="grid grid-cols-2 gap-2">
              <div className="overflow-hidden rounded-lg bg-slate-100">
                {primaryImage ? (
                  <img src={primaryImage} alt={listing.title} className="h-32 w-full object-cover" />
                ) : isUrl ? (
                  <img src={image} alt={listing.title} className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 w-full" style={{ background: image }} />
                )}
              </div>
              <div className="overflow-hidden rounded-lg bg-slate-100">
                {secondaryImage ? (
                  <img src={secondaryImage} alt={`${listing.title} view`} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center px-3 text-center text-[12px] text-slate-400">
                    Street access view
                  </div>
                )}
              </div>
            </div>

            {/* Street view link */}
            <a
              href={streetViewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-brand-700"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="4" r="2.5"/>
                  <path d="M8.5 9.5A1.5 1.5 0 0110 8h4a1.5 1.5 0 011.5 1.5V16a1 1 0 01-1 1h-1v4h-3v-4h-1a1 1 0 01-1-1V9.5z"/>
                </svg>
              </span>
              Open Street View →
            </a>

            <hr className="border-slate-100" />

            <p className="text-[13.5px] leading-6 text-brand-800">{summary}</p>

            {amenities.length > 0 && (
              <div>
                <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Features
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {amenities.map(({ label, icon }) => (
                    <span key={label} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">
                      <AmenityIcon type={icon} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Reviews tab ── */}
        {activeTab === "reviews" && (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            {hasRating ? (
              <>
                <StarRating rating={listing.rating!} />
                <p className="mt-2 text-[30px] font-extrabold text-slate-900">{listing.rating!.toFixed(1)}</p>
                {(listing.ratingCount ?? 0) > 0 && (
                  <p className="mt-0.5 text-[13px] text-slate-400">
                    Based on {listing.ratingCount} review{listing.ratingCount === 1 ? "" : "s"}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[13.5px] text-slate-400">No reviews yet</p>
            )}
          </div>
        )}

        {/* ── Availability tab ── */}
        {activeTab === "availability" && (
          <AvailabilityGrid listing={listing} availabilityText={availabilityText} />
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
}: {
  listing: Listing;
  availabilityText: string;
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
      <div className="divide-y divide-slate-100 px-4">
        {rows.map(({ label, hours, isToday }) => (
          <div
            key={label}
            className={`flex items-center justify-between py-2.5 ${isToday ? "font-semibold" : ""}`}
          >
            <span className={`text-[13px] ${isToday ? "text-slate-900" : "text-slate-500"}`}>
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
    <div className="px-4 py-4">
      <p className="text-[13.5px] leading-6 text-slate-600">{availabilityText}</p>
    </div>
  );
}

// ── Amenity icon ──────────────────────────────────────────────────────────────

function AmenityIcon({ type }: { type: string }) {
  if (type === "covered") return (
    <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === "gated") return (
    <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  );
  if (type === "cctv") return (
    <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M3 8h12a2 2 0 012 2v4a2 2 0 01-2 2H3a2 2 0 01-2-2v-4a2 2 0 012-2z" strokeLinecap="round"/>
    </svg>
  );
  if (type === "ev") return (
    <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === "disabled") return (
    <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="5" r="2"/><path d="M12 7v6l3 3m-3-3H9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  // 24/7
  return (
    <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
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
  return "Every day";
}

function buildOverlaySummary(
  listing: Listing,
  context: { amenities: string[]; spaceType?: string; availabilityText: string },
) {
  const locality = listing.address.split(",").slice(0, 2).join(", ").trim() || listing.address;
  const amenityText =
    context.amenities.length > 0
      ? ` Features include ${context.amenities.slice(0, 3).join(", ").toLowerCase()}.`
      : "";
  const typeText = context.spaceType ? `${context.spaceType.toLowerCase()} parking` : "parking";
  return `Book ${typeText} near ${locality}. ${context.availabilityText}.${amenityText}`;
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
