"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { SearchForm } from "./SearchForm";
import { MapView } from "./MapView";
import { FiltersPanel } from "./FiltersPanel";
import { listingGradient } from "./DesktopSearchLayout";
import type { SharedLayoutProps } from "./searchLayoutTypes";
import type { Listing } from "./ListingCard";

// ── Date/time helpers ────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(n: number) { return String(n).padStart(2, "0"); }

function formatDate(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function formatTime(d: Date): string { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

function parseDatetime(dateStr: string | undefined, timeStr: string): Date {
  if (!dateStr) return new Date();
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function hasActiveFilters(f: SharedLayoutProps["filters"]): boolean {
  return !!(f.priceMin || f.priceMax || f.securityLevel || f.vehicleSize || f.coveredParking || f.evCharging || f.instantBook);
}

// ── Main component ───────────────────────────────────────────────────────────

export function MobileSearchLayout({
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
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);

  const selectedListing = selectedListingId ? results.find((l) => l.id === selectedListingId) ?? null : null;
  const startAt = parseDatetime(filters.date, filters.startTime ?? "09:00");
  const endAt = parseDatetime(filters.endDate ?? filters.date, filters.endTime ?? "18:00");

  const dismissCard = () => onMarkerSelect("");

  return (
    <div className="relative h-[100dvh] overflow-hidden">
      {/* ── Full-screen map ── */}
      <div className="absolute inset-0">
        <MapView
          listings={results}
          center={center}
          initialZoom={16}
          maxZoom={17}
          minFitZoom={16}
          showCenterPin
          selectedListingId={selectedListingId ?? undefined}
          popupListing={undefined}
          onPopupBook={onPopupBook}
          onSelectListing={onMarkerSelect}
          onMarkerClick={onMarkerClick}
          disableAutoFit={lockViewport}
          onBoundsChanged={onBoundsChanged}
        />
      </div>

      {/* ── Top overlay: search bar + date row ── */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-col gap-2.5 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
      >
        {/* Search bar row */}
        <div className="pointer-events-auto flex items-center gap-2.5">
          <button
            onClick={() => setSearchPanelOpen(true)}
            className="flex h-11 flex-1 items-center gap-2.5 rounded-[22px] bg-white px-[14px] shadow-[0_6px_12px_rgba(15,23,42,0.12)]"
          >
            <SearchIcon />
            <span className="flex-1 truncate text-left text-[15px] font-medium text-[#0f172a]">
              {filters.location || "Where are you parking?"}
            </span>
          </button>

          <button
            onClick={() => setFiltersPanelOpen(true)}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_4px_8px_rgba(15,23,42,0.10)]"
          >
            <FiltersIcon />
            {hasActiveFilters(filters) && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500" />
            )}
          </button>
        </div>

        {/* Date row */}
        <button
          onClick={() => setSearchPanelOpen(true)}
          className="pointer-events-auto w-full rounded-2xl bg-white px-[14px] py-[10px] text-left shadow-[0_4px_12px_rgba(15,23,42,0.08)]"
        >
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-medium tracking-[0.2px] text-[#6B7280]">From</p>
              <p className="truncate text-sm font-bold leading-tight text-[#111827]">
                {formatDate(startAt)} · {formatTime(startAt)}
              </p>
            </div>
            <svg className="mx-1 h-[18px] w-[18px] shrink-0 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="min-w-0 flex-1 text-right">
              <p className="mb-1 text-[11px] font-medium tracking-[0.2px] text-[#6B7280]">Until</p>
              <p className="truncate text-sm font-bold leading-tight text-[#111827]">
                {formatDate(endAt)} · {formatTime(endAt)}
              </p>
            </div>
          </div>
        </button>

        {/* Loading pill */}
        {status === "loading" && (
          <div className="pointer-events-auto flex justify-center">
            <span className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-[#6B7280] shadow-md">
              Searching…
            </span>
          </div>
        )}
      </div>

      {/* ── "Search this area" button ── */}
      {pendingCenter && mapDirty && !searchAsMove && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+24px)] z-10 flex justify-center">
          <button
            type="button"
            disabled={areaSearching}
            onClick={onSearchArea}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-[0_4px_16px_rgba(15,23,42,0.15)] ring-1 ring-brand-200 disabled:opacity-60"
          >
            <RefreshIcon />
            {areaSearching ? "Searching…" : "Search this area"}
          </button>
        </div>
      )}

      {/* ── Bottom card — slides up when a pin is selected ── */}
      <div
        className={`pointer-events-none absolute bottom-0 left-0 right-0 z-20 px-4 transition-transform duration-300 ease-out ${
          selectedListing ? "pointer-events-auto translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        {selectedListing && (
          <MapBottomCard
            listing={selectedListing}
            onDismiss={dismissCard}
            onOpen={() => router.push(`/listing/${selectedListing.id}`)}
          />
        )}
      </div>

      {/* ── Full-screen search panel ── */}
      {searchPanelOpen && (
        <div className="absolute inset-0 z-30 flex flex-col bg-white">
          <div
            className="flex items-center justify-between bg-brand-500 px-5 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
          >
            <h2 className="text-base font-semibold text-white">Search</h2>
            <button
              onClick={() => setSearchPanelOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <SearchForm
              initialValues={filters}
              onSearch={(f) => { onSearch(f, true); setSearchPanelOpen(false); }}
              autoSearch={false}
              onAddressChange={onAddressChange}
            />
          </div>
        </div>
      )}

      {/* ── Full-screen filters panel ── */}
      {filtersPanelOpen && (
        <div className="absolute inset-0 z-30 flex flex-col bg-white">
          <div
            className="flex items-center justify-between bg-brand-500 px-5 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
          >
            <h2 className="text-base font-semibold text-white">Filters</h2>
            <button
              onClick={() => setFiltersPanelOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <FiltersPanel
              initialFilters={filters}
              onApply={(next) => { onSearch(next, true); setFiltersPanelOpen(false); }}
              onCancel={() => setFiltersPanelOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── MapBottomCard ─────────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, React.ReactElement> = {
  CCTV: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M3 8h12a2 2 0 012 2v4a2 2 0 01-2 2H3a2 2 0 01-2-2v-4a2 2 0 012-2z" strokeLinecap="round" />
    </svg>
  ),
  "EV charging": (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Gated: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  Covered: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function normaliseAmenity(v: string): string {
  const s = v.toLowerCase();
  if (s.includes("cctv") || s.includes("camera")) return "CCTV";
  if (s.includes("ev") || s.includes("charg")) return "EV charging";
  if (s.includes("gate") || s.includes("barrier")) return "Gated";
  if (s.includes("cover") || s.includes("shelter") || s.includes("roof")) return "Covered";
  return v.trim();
}

function MapBottomCard({
  listing,
  onDismiss,
  onOpen,
}: {
  listing: Listing;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const image = listingGradient(listing);
  const isUrl = image?.startsWith("http");
  const amenities: string[] = (listing as any).amenities ?? listing.tags ?? [];
  const features = [...new Set(amenities.map(normaliseAmenity))].slice(0, 3);

  return (
    <div className="overflow-hidden rounded-xl border border-[#374151] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.18)]">
      {/* Image strip */}
      <div className="relative h-[92px] w-full">
        {isUrl ? (
          <Image src={image} alt={listing.title} fill className="object-cover" sizes="100vw" />
        ) : (
          <div className="h-full w-full" style={{ background: image }} />
        )}

        {/* Rating badge */}
        {listing.rating > 0 && (
          <div className="absolute right-2 top-2 rounded-full bg-black/75 px-2 py-1">
            <span className="text-[12px] font-bold tracking-[0.2px] text-white">★ {listing.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Content */}
      <div className="px-[10px] pb-[10px] pt-2">
        <p className="mb-1 line-clamp-1 text-sm font-bold leading-[18px] tracking-[-0.2px] text-[#111827]">
          {listing.title}
        </p>
        <p className="mb-1.5 line-clamp-1 text-[11px] text-[#6B7280]">{listing.address}</p>

        {/* Rating + amenity icons */}
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-[#6B7280]">
            <span className="text-[#F2B01E]">★</span> {listing.rating.toFixed(1)}
            {typeof listing.ratingCount === "number" && listing.ratingCount > 0
              ? ` · ${listing.ratingCount} reviews`
              : " · New listing"}
          </span>
          {features.length > 0 && (
            <div className="flex items-center gap-1.5">
              {features.map((f) => (
                <div
                  key={f}
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111]"
                  title={f}
                >
                  {AMENITY_ICONS[f] ?? <span className="text-[10px]">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dashed divider */}
        <div className="mb-2 border-t border-dashed border-[#E5E7EB]" />

        {/* Price + reserve button */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280]">Reserve now</p>
            <p className="text-lg font-extrabold tracking-[-0.5px] text-brand-500">
              €{listing.pricePerDay}<span className="text-xs font-semibold text-[#6B7280]">/day</span>
            </p>
          </div>
          <button
            onClick={onOpen}
            className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-95"
          >
            View &amp; book
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}
function FiltersIcon() {
  return (
    <svg className="h-4 w-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M3 6h18M7 12h10M11 18h2" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
