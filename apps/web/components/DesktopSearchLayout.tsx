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
    if (sortMode === "cheapest") return [...results].sort((a, b) => a.pricePerDay - b.pricePerDay);
    if (sortMode === "closest") return [...results].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    return results;
  }, [results, sortMode]);

  const SORT_TABS = [
    { key: "recommended", label: "Best match" },
    { key: "cheapest",    label: "Cheapest" },
    { key: "closest",     label: "Closest" },
  ] as const;

  return (
    <div className="flex h-[100dvh] min-w-0 flex-col bg-[#f8fafc]">
      <SlimNav />

      {/* ── Search + controls strip ── */}
      <div className="border-b border-slate-200/80 bg-white px-6 shadow-sm">

        {/* Search form */}
        <div className="pt-4 pb-2">
          <SearchForm
            initialValues={filters}
            onSearch={(f) => onSearch(f, true)}
            onOpenFilters={() => setShowFilters(true)}
            autoSearch={false}
            onAddressChange={onAddressChange}
            variant="desktop-inline"
          />
        </div>

        {/* Sort tabs + search-as-move + filter button */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-0.5 rounded-full bg-slate-100 p-1">
            {SORT_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSortMode(tab.key)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-150 ${
                  sortMode === tab.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Search as I move */}
            <label className="flex cursor-pointer items-center gap-2">
              <div
                onClick={() => onSearchAsMove?.(!searchAsMove)}
                className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
                  searchAsMove ? "bg-brand-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    searchAsMove ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-[12px] font-medium text-slate-600">Search as I move</span>
            </label>

            {/* Filters button */}
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className="relative inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4 text-slate-400" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="grid h-full min-w-0 grid-cols-[460px,1fr] gap-4 overflow-hidden px-6 pb-0 pt-4">

        {/* Left sidebar */}
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <div className="relative flex-1 overflow-hidden">
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
                  />
                </motion.div>

              ) : showListingOverlay && selectedListing ? (
                <motion.div
                  key={`overlay-${selectedListing.id}`}
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  transition={{ type: "spring", damping: 24, stiffness: 380, mass: 0.8 }}
                  className="h-full"
                >
                  <ListingOverlay
                    listing={selectedListing}
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
                  className="space-y-3 pb-4"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 pt-0.5">
                    <div>
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
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
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
          className="h-full min-w-0"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="relative h-full overflow-hidden">
            <MapView
              listings={results}
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
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

function ListingOverlay({
  listing,
  onClose,
  onOpen,
}: {
  listing: Listing;
  onClose: () => void;
  onOpen: () => void;
}) {
  const image = listingGradient(listing);
  const isUrl = image?.startsWith("http");

  const hasRating    = typeof listing.rating === "number" && listing.rating > 0;
  const isInstant    = listing.tags?.some(t => t.toLowerCase().includes("instant"));
  const hasCctv      = listing.tags?.some(t => t.toLowerCase().includes("cctv") || t.toLowerCase().includes("camera"));
  const hasEv        = listing.tags?.some(t => t.toLowerCase().includes("ev") || t.toLowerCase().includes("charg"));
  const hasGated     = listing.tags?.some(t => t.toLowerCase().includes("gat") || t.toLowerCase().includes("barrier"));
  const hasCovered   = listing.tags?.some(t => t.toLowerCase().includes("cover") || t.toLowerCase().includes("shelter") || t.toLowerCase().includes("roof"));
  const hasDisabled  = listing.tags?.some(t => t.toLowerCase().includes("disabled") || t.toLowerCase().includes("wheelchair"));
  const has247       = listing.tags?.some(t => t.toLowerCase().includes("24") || t.toLowerCase().includes("24/7"));
  const spaceType    = deriveSpaceType(listing.tags);
  const isAvailable  = listing.availability?.toLowerCase() !== "unavailable";
  const amenities    = [
    hasCovered  && { label: "Covered",      icon: "covered"  },
    hasGated    && { label: "Gated",        icon: "gated"    },
    hasCctv     && { label: "CCTV",         icon: "cctv"     },
    hasEv       && { label: "EV charging",  icon: "ev"       },
    hasDisabled && { label: "Accessible",   icon: "disabled" },
    has247      && { label: "24/7 access",  icon: "247"      },
  ].filter(Boolean) as { label: string; icon: string }[];

  return (
    <div className="flex flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-md">
      {/* ── Hero image ── */}
      <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-t-2xl">
        {isUrl ? (
          <img src={image} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: image }} />
        )}
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Back button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Rating pill */}
        {hasRating && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur">
            <svg className="h-3 w-3 fill-amber-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span className="text-[12px] font-bold text-white">{listing.rating!.toFixed(1)}</span>
            {(listing.ratingCount ?? 0) > 0 && (
              <span className="text-[10px] text-white/60">({listing.ratingCount})</span>
            )}
          </div>
        )}

        {/* Bottom badges */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          {spaceType && (
            <span className="rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
              {spaceType}
            </span>
          )}
          {isInstant && (
            <span className="rounded-md bg-brand-500/90 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
              ⚡ Instant book
            </span>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col gap-0 divide-y divide-slate-100">

        {/* Title + address + distance */}
        <div className="px-5 py-4">
          <h2 className="text-[17px] font-bold leading-snug tracking-tight text-slate-900">{listing.title}</h2>
          <p className="mt-1 flex items-center gap-1 text-[12.5px] text-slate-500">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            <span className="line-clamp-1">{listing.address}</span>
          </p>

          {/* Rating row */}
          {hasRating && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <svg key={n} className={`h-3.5 w-3.5 ${n <= Math.round(listing.rating!) ? "fill-amber-400" : "fill-slate-200"}`} viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                ))}
              </div>
              <span className="text-[12px] font-semibold text-slate-700">{listing.rating!.toFixed(1)}</span>
              {(listing.ratingCount ?? 0) > 0 && (
                <span className="text-[12px] text-slate-400">· {listing.ratingCount} reviews</span>
              )}
              {listing.distanceKm != null && (
                <span className="ml-auto text-[12px] font-medium text-slate-400">{listing.distanceKm.toFixed(1)} km away</span>
              )}
            </div>
          )}
          {!hasRating && listing.distanceKm != null && (
            <p className="mt-1.5 text-[12px] font-medium text-slate-400">{listing.distanceKm.toFixed(1)} km away</p>
          )}
        </div>

        {/* Amenity chips */}
        {amenities.length > 0 && (
          <div className="px-5 py-4">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Features</p>
            <div className="flex flex-wrap gap-2">
              {amenities.map(({ label, icon }) => (
                <span key={label} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-semibold text-slate-700">
                  <AmenityIcon type={icon} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Price + availability */}
        <div className="px-5 py-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Price</p>
              <p className="mt-0.5 text-[28px] font-extrabold leading-none tracking-tight text-slate-900">
                €{listing.pricePerDay}
                <span className="ml-1 text-[14px] font-medium text-slate-400">/ day</span>
              </p>
            </div>
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              isAvailable
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}>
              <span className={`h-2 w-2 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
              {isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
        </div>

        {/* Trust row */}
        <div className="flex items-center gap-4 px-5 py-3">
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-slate-500">
            <svg className="h-3.5 w-3.5 text-brand-500" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08z" clipRule="evenodd"/>
            </svg>
            Secure booking
          </span>
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-slate-500">
            <svg className="h-3.5 w-3.5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Free cancellation
          </span>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 px-5 py-4">
          <button
            onClick={onOpen}
            className="flex-1 rounded-xl bg-brand-500 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-brand-600 hover:-translate-y-px active:scale-[0.98]"
          >
            Reserve now →
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Details
          </button>
        </div>
      </div>
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
