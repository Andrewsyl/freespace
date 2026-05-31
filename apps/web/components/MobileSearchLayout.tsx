"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
} from "framer-motion";
import * as Select from "@radix-ui/react-select";
import { SearchForm } from "./SearchForm";
import { MapView } from "./MapView";
import { FiltersPanel } from "./FiltersPanel";
import { listingGradient } from "./DesktopSearchLayout";
import { SlimNav } from "./SlimNav";
import type { SharedLayoutProps } from "./searchLayoutTypes";
import type { Listing } from "./ListingCard";
import { calculateListingTotal, formatPriceValue } from "../lib/pricing";
import { Search, SlidersHorizontal, X, RefreshCw, List, MapPin, Star, ChevronLeft, ChevronRight, Check, Camera, Zap, Lock, Home } from "lucide-react";

// ── Date/time helpers ────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const TIME_SLOTS = Array.from({ length: 24 * 2 }, (_, i) =>
  `${pad2(Math.floor(i / 2))}:${i % 2 === 0 ? "00" : "30"}`,
);

function pad2(n: number) { return String(n).padStart(2, "0"); }

function roundUpToHalfHour(d: Date): Date {
  const out = new Date(d);
  out.setMinutes(Math.ceil(out.getMinutes() / 30) * 30, 0, 0);
  return out;
}

function formatDate(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseDatetime(dateStr: string | undefined, timeStr: string): Date {
  if (!dateStr) return new Date();
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function hasActiveFilters(f: SharedLayoutProps["filters"]): boolean {
  return !!(
    f.priceMin || f.priceMax || f.securityLevel ||
    f.vehicleSize || f.coveredParking || f.evCharging || f.instantBook
  );
}

// ── Sort ─────────────────────────────────────────────────────────────────────

const SORT_TABS = [
  { key: "recommended", label: "Recommended" },
  { key: "cheapest", label: "Cheapest" },
  { key: "rating", label: "Top rated" },
];

function sortResults(results: Listing[], mode: string): Listing[] {
  const sorted = [...results];
  if (mode === "cheapest")
    sorted.sort((a, b) => (a.pricePerDay ?? 999) - (b.pricePerDay ?? 999));
  else if (mode === "rating")
    sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return sorted;
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
      label: "Per month",
      value,
      suffix: "/month",
    };
  }

  const total = calculateListingTotal(listing, start, end);
  return {
    sortValue: total.total,
    label: "Total",
    value: total.total,
    suffix: `for ${total.durationLabel}`,
  };
}

// ── Main component ───────────────────────────────────────────────────────────

export function MobileSearchLayout({
  filters,
  results,
  status,
  center,
  selectedListingId,
  lockViewport,
  searchAsMove,
  pendingCenter,
  mapDirty,
  areaSearching,
  onSearch,
  onAddressChange,
  onMarkerSelect,
  onMarkerClick,
  onBoundsChanged,
  onSearchArea,
  onSearchAsMove,
}: SharedLayoutProps) {
  const router = useRouter();
  const { start: searchStart, end: searchEnd } = useMemo(() => getSearchWindow(filters), [filters]);
  const listingHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("date", filters.date);
    params.set("startTime", filters.startTime);
    params.set("endDate", filters.endDate ?? filters.date);
    params.set("endTime", filters.endTime);
    if (filters.mode) params.set("mode", filters.mode);
    if (filters.monthlyPlan) params.set("monthlyPlan", filters.monthlyPlan);
    if (filters.latitude != null) params.set("fromLat", String(filters.latitude));
    if (filters.longitude != null) params.set("fromLng", String(filters.longitude));
    return (listingId: string) => `/listing/${listingId}?${params.toString()}`;
  }, [filters.date, filters.endDate, filters.endTime, filters.latitude, filters.longitude, filters.mode, filters.monthlyPlan, filters.startTime]);
  const getSearchPrice = useMemo(
    () => (listing: Listing) => buildSearchPriceDisplay(listing, filters, searchStart, searchEnd),
    [filters, searchEnd, searchStart]
  );
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<"start" | "end" | null>(null);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [sortMode, setSortMode] = useState("recommended");
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  const selectedListing = selectedListingId
    ? results.find((l) => l.id === selectedListingId) ?? null
    : null;

  const sortedResults = useMemo(() => {
    if (sortMode === "cheapest") {
      return [...results].sort((a, b) => getSearchPrice(a).sortValue - getSearchPrice(b).sortValue);
    }
    return sortResults(results, sortMode);
  }, [getSearchPrice, results, sortMode]);

  // Date/time
  const fallbackStart = useMemo(() => roundUpToHalfHour(new Date()), []);
  const fallbackStartTime = `${pad2(fallbackStart.getHours())}:${pad2(fallbackStart.getMinutes())}`;
  const startAt = parseDatetime(filters.date, filters.startTime ?? fallbackStartTime);
  const fallbackEnd = new Date(startAt.getTime() + 120 * 60000);
  const endAt = parseDatetime(
    filters.endDate ?? filters.date,
    filters.endTime ?? formatTime(fallbackEnd),
  );

  function switchToList() {
    setViewMode("list");
    onMarkerSelect("");
  }

  function switchToMap() {
    setViewMode("map");
  }

  return (
    <>
    <SlimNav />
    <div className="mobile-search relative overflow-hidden" style={{ height: "calc(100dvh - 64px)" }}>

      {/* ── Map View ── */}
      {viewMode === "map" && (
        <>
          {/* Full-screen map */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <MapView
              listings={results}
              center={center}
              initialZoom={16}
              maxZoom={17}
              minFitZoom={16}
              controlsPosition="bottom-right"
              controlsOffset={{ bottom: 80, right: 12 }}
              showCenterPin
              centerPinRadius={500}
              priceMode={filters.mode ?? "daily"}
              priceForListing={(listing) => getSearchPrice(listing).sortValue}
              priceKey={`${filters.mode ?? "daily"}-${filters.date}-${filters.startTime}-${filters.endDate ?? filters.date}-${filters.endTime}`}
              selectedListingId={selectedListingId ?? undefined}
              onSelectListing={onMarkerSelect}
              onMarkerClick={onMarkerClick}
              disableAutoFit={lockViewport}
              onBoundsChanged={onBoundsChanged}
            />
          </motion.div>

          {/* Top bar */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 px-3 pt-2">
            <div className="pointer-events-auto flex items-center">
              <button
                type="button"
                onClick={() => setSearchPanelOpen(true)}
                className="flex h-12 flex-1 items-center gap-3 rounded-2xl bg-white px-4 shadow-[0_4px_16px_rgba(15,23,42,0.16)]"
              >
                <SearchIcon />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13.5px] font-semibold leading-tight text-slate-900">
                    {filters.location || "Where are you parking?"}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-400">
                    {formatDate(startAt)} · {formatTime(startAt)} → {formatTime(endAt)}
                  </p>
                </div>
                <ChevronLeft className="h-3.5 w-3.5 shrink-0 -rotate-90 text-slate-400" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* "Search this area" button */}
          {pendingCenter && mapDirty && !searchAsMove && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 flex justify-center"
              style={{ top: "calc(env(safe-area-inset-top) + 72px)" }}
            >
              <button
                type="button"
                disabled={areaSearching}
                onClick={onSearchArea}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-[0_4px_16px_rgba(15,23,42,0.18)] ring-1 ring-brand-200 disabled:opacity-60"
              >
                <RefreshIcon />
                {areaSearching ? "Searching…" : "Search this area"}
              </button>
            </div>
          )}

          {/* "List" toggle — hidden when a card is shown */}
          {!selectedListing && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex justify-center"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            >
              <button
                type="button"
                onClick={switchToList}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-slate-800 shadow-[0_4px_20px_rgba(15,23,42,0.22)] ring-1 ring-slate-200 active:bg-slate-50"
              >
                <ListIcon />
                {results.length > 0 ? `List · ${results.length}` : "List"}
              </button>
            </div>
          )}

          {/* Selected listing card */}
          <AnimatePresence>
            {selectedListing && (
              <motion.div
                key={selectedListing.id}
                className="absolute bottom-0 left-0 right-0 z-30 px-4"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
              >
                <MapBottomCard
                  listing={selectedListing}
                  priceDisplay={getSearchPrice(selectedListing)}
                  onDismiss={() => onMarkerSelect("")}
                  onOpen={() => router.push(listingHref(selectedListing.id) as any)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── List View ── */}
      <AnimatePresence>
      {viewMode === "list" && (
        <motion.div
          className="absolute inset-0 z-10 flex flex-col bg-white"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 300 }}
        >
          {/* Sticky header */}
          <div className="shrink-0 bg-white px-3 pt-2 pb-0 shadow-[0_1px_0_rgba(15,23,42,0.08)]">
            {/* Search pill + filter button */}
            <div className="flex items-center gap-2 pb-2">
              <button
                type="button"
                onClick={() => setSearchPanelOpen(true)}
                className="flex h-11 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5"
              >
                <SearchIcon />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13px] font-semibold leading-tight text-slate-900">
                    {filters.location || "Where are you parking?"}
                  </p>
                  <p className="text-[10.5px] leading-tight text-slate-400">
                    {formatDate(startAt)} · {formatTime(startAt)} → {formatTime(endAt)}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFiltersPanelOpen(true)}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 active:bg-slate-100"
              >
                <FiltersIcon />
                {hasActiveFilters(filters) && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white" />
                )}
              </button>
            </div>

            {/* Count row */}
            <div className="flex items-center justify-between pb-1">
              <p className="text-[13px] font-semibold text-slate-500">
                {status === "loading"
                  ? "Searching…"
                  : results.length === 0
                    ? filters.location ? "No spaces found" : "Search to find spaces"
                    : `${results.length} space${results.length === 1 ? "" : "s"} nearby`}
              </p>
            </div>

            {/* Sort tabs */}
            {results.length > 0 && (
              <div className="flex border-t border-slate-100">
                {SORT_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSortMode(tab.key)}
                    className={`pb-2.5 pr-5 pt-2 text-[12.5px] font-semibold transition ${
                      sortMode === tab.key
                        ? "border-b-[2.5px] border-brand-500 text-brand-600"
                        : "border-b-[2.5px] border-transparent text-slate-400"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable results */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {status === "loading" && (
              <div className="flex items-center justify-center py-14">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  <span className="text-[13px] text-slate-400">Finding spaces…</span>
                </div>
              </div>
            )}

            {status !== "loading" && results.length === 0 && (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-3 text-4xl">🅿️</div>
                <p className="text-[15px] font-semibold text-slate-700">
                  {filters.location ? "No spaces found" : "Start your search"}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                  {filters.location
                    ? "Try a different area or clear your filters"
                    : "Search for a location above to see available spaces"}
                </p>
                {filters.location && (
                  <button
                    type="button"
                    onClick={() => setSearchPanelOpen(true)}
                    className="mt-5 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white"
                  >
                    Edit search
                  </button>
                )}
              </div>
            )}

            {status !== "loading" &&
              sortedResults.map((listing) => (
                <ResultCard
                  key={listing.id}
                  listing={listing}
                  priceDisplay={getSearchPrice(listing)}
                  selected={listing.id === selectedListingId}
                  onOpen={() => router.push(listingHref(listing.id) as any)}
                  onSelect={() => {
                    onMarkerSelect(listing.id);
                    switchToMap();
                  }}
                />
              ))}

            <div style={{ height: "calc(env(safe-area-inset-bottom) + 80px)" }} />
          </div>

          {/* "Map" toggle bar */}
          <div
            className="shrink-0 flex justify-center border-t border-slate-100 bg-white py-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <button
              type="button"
              onClick={switchToMap}
              className="flex items-center gap-2 rounded-full bg-slate-900 px-7 py-2.5 text-[13px] font-semibold text-white shadow-md active:bg-slate-700"
            >
              <MapPinIcon />
              Map
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Full-screen search panel ── */}
      <AnimatePresence>
        {searchPanelOpen && (
          <motion.div
            key="search-panel"
            className="absolute inset-0 z-50 flex flex-col bg-white"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
          >
            <div
              className="flex items-center justify-between bg-brand-500 px-5 pb-3"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
            >
              <h2 className="text-base font-semibold text-white">Find parking</h2>
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
                onSearch={(f) => {
                  onSearch(f, true);
                  setSearchPanelOpen(false);
                }}
                autoSearch={false}
                onAddressChange={onAddressChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Date/time picker ── */}
      <AnimatePresence>
        {pickerOpen && (
          <DateTimeSheet
            key="datetime-sheet"
            field={pickerOpen}
            startAt={startAt}
            endAt={endAt}
            onConfirm={(next) => {
              const toDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const toTime = (d: Date) =>
                `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
              if (pickerOpen === "start") {
                const updatedEnd =
                  next >= endAt ? new Date(next.getTime() + 120 * 60000) : endAt;
                onSearch(
                  {
                    ...filters,
                    date: toDate(next),
                    startTime: toTime(next),
                    endDate: toDate(updatedEnd),
                    endTime: toTime(updatedEnd),
                  },
                  true,
                  { preserveViewport: true },
                );
              } else {
                if (next > startAt) {
                  onSearch(
                    {
                      ...filters,
                      endDate: toDate(next),
                      endTime: toTime(next),
                    },
                    true,
                    { preserveViewport: true },
                  );
                }
              }
              setPickerOpen(null);
            }}
            onClose={() => setPickerOpen(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Filters panel ── */}
      <AnimatePresence>
        {filtersPanelOpen && (
          <motion.div
            key="filters-panel"
            className="absolute inset-0 z-40 flex flex-col bg-white"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
          >
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
                onApply={(next) => {
                  onSearch(next, true);
                  setFiltersPanelOpen(false);
                }}
                onCancel={() => setFiltersPanelOpen(false)}
                searchAsMove={searchAsMove}
                onSearchAsMove={onSearchAsMove}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────────

function ResultCard({
  listing,
  priceDisplay,
  selected,
  onOpen,
  onSelect,
}: {
  listing: Listing;
  priceDisplay: { label: string; value: number; suffix: string };
  selected: boolean;
  onOpen: () => void;
  onSelect: () => void;
}) {
  const image = listingGradient(listing);
  const isUrl = image?.startsWith("http");
  const amenities: string[] = (listing as any).amenities ?? listing.tags ?? [];

  return (
    <div
      className={`flex cursor-pointer gap-3 border-b border-slate-100 px-4 py-3.5 transition active:bg-slate-50 ${
        selected ? "bg-brand-50" : ""
      }`}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="relative h-[88px] w-[100px] shrink-0 overflow-hidden rounded-xl">
        {isUrl ? (
          <img src={image} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: image }} />
        )}
        {selected && (
          <div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-brand-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-[14px] font-bold leading-snug text-slate-900">
              {listing.title}
            </p>
            <p className="shrink-0 text-[16px] font-extrabold tracking-tight text-brand-600">
              €{formatPriceValue(priceDisplay.value)}
              <span className="text-[10px] font-semibold text-slate-400">{priceDisplay.suffix}</span>
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <p className="line-clamp-1 text-[11.5px] text-slate-400">{listing.address}</p>
            {typeof listing.distanceKm === "number" && (
              <span className="shrink-0 text-[11px] font-medium text-slate-400">· {listing.distanceKm.toFixed(1)} km</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-500">
              <span className="text-amber-500">★</span>{" "}
              {(listing.rating ?? 0).toFixed(1)}
              {typeof listing.ratingCount === "number" && listing.ratingCount > 0
                ? ` · ${listing.ratingCount}`
                : ""}
            </span>
            {amenities.length > 0 && (
              <div className="flex items-center gap-1">
                {amenities.slice(0, 2).map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                  >
                    {a.length > 10 ? a.slice(0, 9) + "…" : a}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DateTimeSheet ─────────────────────────────────────────────────────────────

function DateTimeSheet({
  field,
  startAt,
  endAt,
  onConfirm,
  onClose,
}: {
  field: "start" | "end";
  startAt: Date;
  endAt: Date;
  onConfirm: (d: Date) => void;
  onClose: () => void;
}) {
  const current = field === "start" ? startAt : endAt;
  const [draft, setDraft] = useState(current);
  const [viewYear, setViewYear] = useState(current.getFullYear());
  const [viewMonth, setViewMonth] = useState(current.getMonth());

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const minDay = field === "end"
    ? (() => { const d = new Date(startAt); d.setHours(0, 0, 0, 0); return d; })()
    : today;

  const calDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push(new Date(viewYear, viewMonth, d));
    }
    return cells;
  }, [viewYear, viewMonth]);

  const timeValue = `${pad2(draft.getHours())}:${pad2(draft.getMinutes())}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      initial={{ y: "100%", opacity: 0.98 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0.98 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
    >
      <div className="relative z-10 flex h-full flex-col bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[18px] font-semibold text-[#0f172a]">
            {field === "start" ? "Park from" : "Park until"}
          </h2>
          <button type="button" onClick={onClose} className="text-[14px] font-semibold text-brand-600">
            Cancel
          </button>
        </div>

        <div className="flex items-center justify-between px-5 pb-3">
          <span className="text-[14px] font-semibold text-[#1F2937]">
            {MONTHS_LONG[viewMonth]} {viewYear}
          </span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={prevMonth} className="p-1 text-brand-600">
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button type="button" onClick={nextMonth} className="p-1 text-brand-600">
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 px-5 pb-2">
          {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-[#B0B8C5]">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 content-start gap-y-2 px-5 py-2">
          {calDays.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
            const isDisabled = dayStart < minDay;
            const isToday = dayStart.getTime() === today.getTime();
            const isSelected = draft.toDateString() === day.toDateString();
            return (
              <button
                key={day.getTime()}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  const next = new Date(day);
                  next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
                  setDraft(next);
                }}
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition ${
                  isSelected
                    ? "bg-brand-500 font-semibold text-white"
                    : isToday
                      ? "border border-brand-500 font-semibold text-brand-700"
                      : isDisabled
                        ? "text-[#C7CDD8]"
                        : "font-medium text-[#0f172a] active:bg-[#F1F5F9]"
                }`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <div
          className="mt-auto flex items-center gap-3 border-t border-[#EEF2F7] px-5 py-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <span className="text-[13px] text-[#6B7280]">
            {field === "start" ? "Enter after" : "Leave by"}
          </span>
          <TimeSelect
            value={timeValue}
            onChange={(value) => {
              if (!value) return;
              const [h, m] = value.split(":").map(Number);
              const next = new Date(draft);
              next.setHours(h, m, 0, 0);
              setDraft(next);
            }}
          />
          <button
            type="button"
            onClick={() => onConfirm(draft)}
            className="ml-auto rounded-xl bg-brand-500 px-6 py-2.5 text-[14px] font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TimeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#0f172a] shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-label="Select time"
      >
        <Select.Value />
        <Select.Icon className="text-brand-500">
          <ChevronLeft className="h-4 w-4 -rotate-90" strokeWidth={2.5} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="z-[60] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          position="popper"
          sideOffset={8}
        >
          <Select.Viewport className="max-h-64 p-2">
            {TIME_SLOTS.map((t) => (
              <Select.Item
                key={t}
                value={t}
                className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50 data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-700"
              >
                <Select.ItemText>{t}</Select.ItemText>
                <Select.ItemIndicator className="text-brand-500">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

// ── MapBottomCard ─────────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, React.ReactElement> = {
  CCTV:        <Camera className="h-3.5 w-3.5" strokeWidth={2} />,
  "EV charging": <Zap className="h-3.5 w-3.5" strokeWidth={2} />,
  Gated:       <Lock className="h-3.5 w-3.5" strokeWidth={2} />,
  Covered:     <Home className="h-3.5 w-3.5" strokeWidth={2} />,
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
  priceDisplay,
  onDismiss,
  onOpen,
}: {
  listing: Listing;
  priceDisplay: { label: string; value: number; suffix: string };
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const image = listingGradient(listing);
  const isUrl = image?.startsWith("http");
  const amenities: string[] = (listing as any).amenities ?? listing.tags ?? [];
  const features = [...new Set(amenities.map(normaliseAmenity))].slice(0, 3);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.20)]">
      {/* Image strip */}
      <div className="relative h-[96px] w-full">
        {isUrl ? (
          <img src={image} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: image }} />
        )}
        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm"
        >
          <CloseIcon />
        </button>
        {/* Rating */}
        {(listing.rating ?? 0) > 0 && (
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1">
            <span className="text-[12px] font-bold text-white">★ {(listing.rating ?? 0).toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 pb-3 pt-2.5">
        <p className="line-clamp-1 text-[14px] font-bold text-slate-900">{listing.title}</p>
        <p className="mt-0.5 line-clamp-1 text-[11.5px] text-slate-400">{listing.address}</p>

        <div className="mt-2 mb-2 flex items-center justify-between">
          <span className="text-[11.5px] text-slate-500">
            <span className="text-amber-500">★</span> {(listing.rating ?? 0).toFixed(1)}
            {typeof listing.ratingCount === "number" && listing.ratingCount > 0
              ? ` · ${listing.ratingCount} reviews`
              : " · New"}
          </span>
          {features.length > 0 && (
            <div className="flex items-center gap-1.5">
              {features.map((f) => (
                <div
                  key={f}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
                  title={f}
                >
                  {AMENITY_ICONS[f] ?? <span className="text-[10px]">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-100 pt-2.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{priceDisplay.label}</p>
            <p className="text-[18px] font-extrabold tracking-tight text-brand-600">
              €{formatPriceValue(priceDisplay.value)}
            </p>
            <p className="text-[10px] font-medium text-slate-400">{priceDisplay.suffix}</p>
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

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon() { return <Search className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2.5} />; }
function FiltersIcon() { return <SlidersHorizontal className="h-3.5 w-3.5 text-slate-600" strokeWidth={2} />; }
function CloseIcon() { return <X className="h-3 w-3" strokeWidth={2.5} />; }
function RefreshIcon() { return <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />; }
function ListIcon() { return <List className="h-3.5 w-3.5" strokeWidth={2.5} />; }
function MapPinIcon() { return <MapPin className="h-3.5 w-3.5" strokeWidth={2.5} />; }
