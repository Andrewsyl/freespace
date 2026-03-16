"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ListingCard } from "./ListingCard";
import { SearchForm } from "./SearchForm";
import { MapView } from "./MapView";
import { FiltersPanel } from "./FiltersPanel";
import type { SharedLayoutProps } from "./searchLayoutTypes";
import type { Listing } from "./ListingCard";
import { SlimNav } from "./SlimNav";

export function DesktopSearchLayout({
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
  onSearch,
  onAddressChange,
  onSelectListing,
  onMarkerSelect,
  onMarkerClick,
  onPopupBook,
  onBoundsChanged,
  onSearchArea,
  onSearchAsMove,
}: SharedLayoutProps) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [showListingOverlay, setShowListingOverlay] = useState(false);
  const [sortMode, setSortMode] = useState<"recommended" | "cheapest" | "closest">("recommended");
  const selectedListing = selectedListingId ? results.find((l) => l.id === selectedListingId) ?? null : null;

  useEffect(() => {
    if (!selectedListingId) setShowListingOverlay(false);
  }, [selectedListingId]);

  const listResults = useMemo(() => {
    if (sortMode === "cheapest") {
      return [...results].sort((a, b) => a.pricePerDay - b.pricePerDay);
    }
    if (sortMode === "closest") {
      return [...results].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }
    return results;
  }, [results, sortMode]);

  return (
    <div className="flex h-[100dvh] min-w-0 flex-col bg-slate-50">
      <SlimNav />

      <div className="px-6 pt-4">
        <SearchForm
          initialValues={filters}
          onSearch={(f) => onSearch(f, true)}
          onOpenFilters={() => setShowFilters(true)}
          autoSearch={false}
          onAddressChange={onAddressChange}
        />
      </div>

      <div className="grid h-full min-w-0 grid-cols-[440px,1fr] gap-4 overflow-hidden px-6 pb-5 pt-4">
        {/* Left sidebar */}
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto pr-2">
          {showFilters ? (
            <FiltersPanel
              initialFilters={filters}
              onApply={(next) => { onSearch(next, true); setShowFilters(false); }}
              onCancel={() => setShowFilters(false)}
              onLiveChange={(f) => onSearch(f)}
            />
          ) : showListingOverlay && selectedListing ? (
            <ListingOverlay
              key={selectedListing.id}
              listing={selectedListing}
              onClose={() => setShowListingOverlay(false)}
              onOpen={() => router.push(`/listing/${selectedListing.id}`)}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-emerald-600">Parking spaces</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{results.length} spaces</h1>
                  <p className="text-sm text-slate-600">
                    {filters.mode === "monthly"
                      ? `${filters.date} → ${filters.endDate ?? "30 days out"}`
                      : `${filters.date} ${filters.startTime}–${filters.endTime}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={searchAsMove}
                      onChange={(e) => onSearchAsMove(e.target.checked)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    Search as I move
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFilters(true)}
                    className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-emerald-200 hover:text-emerald-700"
                  >
                    Filters
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                {[
                  { key: "recommended", label: "Recommended" },
                  { key: "cheapest", label: "Cheapest" },
                  { key: "closest", label: "Closest" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSortMode(tab.key as any)}
                    className={`rounded-full px-3 py-1 ${
                      sortMode === tab.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              )}
              {status === "loading" && <p className="text-sm text-slate-600">Searching…</p>}

              <div className="grid grid-cols-1 gap-2 pb-3">
                {listResults.map((listing) => (
                  <div
                    key={listing.id}
                    onClick={() => { onSelectListing(listing); setShowListingOverlay(true); }}
                    className="cursor-pointer rounded-xl border border-slate-100 bg-white shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ animation: "slideUp 180ms ease-out" }}
                  >
                    <ListingCard listing={listing} suppressNavigation selected={selectedListingId === listing.id} />
                  </div>
                ))}
              </div>

              {status === "idle" && results.length === 0 && !error && (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  No spaces found. Adjust the location, dates, or radius.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right pane — map */}
      <motion.div
        className="h-full min-w-0"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <MapView
            listings={results}
            center={center}
            initialZoom={16}
            maxZoom={17}
            minFitZoom={16}
            showCenterPin
            selectedListingId={selectedListingId ?? undefined}
            popupListing={popupListing ?? undefined}
            onPopupBook={onPopupBook}
            onSelectListing={onMarkerSelect}
            onMarkerClick={onMarkerClick}
            disableAutoFit={lockViewport}
            onBoundsChanged={onBoundsChanged}
          />
          {pendingCenter && mapDirty && !searchAsMove && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <button
                type="button"
                disabled={areaSearching}
                onClick={onSearchArea}
                className="pointer-events-auto rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
              >
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

// ── Local sub-components ─────────────────────────────────────────────────────

function ListingOverlay({
  listing,
  onClose,
  onOpen,
}: {
  listing: Listing;
  onClose: () => void;
  onOpen: () => void;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, [listing.id]);

  const image = listingGradient(listing);
  const isUrl = image?.startsWith("http");

  return (
    <div
      className={`flex h-full flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-lg transition-all ease-out ${
        entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
      style={{ transitionDuration: "300ms" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-700">Listing</p>
          <h2 className="text-lg font-semibold text-slate-900">{listing.title}</h2>
          <p className="text-sm text-slate-600">{listing.address}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          ← Back
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {isUrl ? (
          <img src={image} alt={listing.title} className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-48 w-full items-center justify-center text-lg font-semibold text-white" style={{ background: image }}>
            {listing.title}
          </div>
        )}
      </div>
      <div className="grid gap-1 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">€{listing.pricePerDay} / day</span>
        <span>{listing.availability ?? "Available"}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={onOpen} className="btn-primary flex-1 justify-center">
          View details
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Back to list
        </button>
      </div>
    </div>
  );
}

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
