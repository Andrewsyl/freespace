"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import * as Select from "@radix-ui/react-select";
import type { SearchFilters } from "./SearchForm";

type PlaceResult = { address: string; lat: number; lng: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const MONTHLY_OPTIONS = [
  { value: "full_week", label: "Everyday" },
  { value: "weekdays", label: "Mon – Fri only" },
  { value: "any_3_days", label: "Any 3 days" },
] as const;

const TIME_SLOTS = Array.from({ length: 24 * 2 }, (_, i) =>
  `${pad2(Math.floor(i / 2))}:${i % 2 === 0 ? "00" : "30"}`,
);

function pad2(n: number) { return String(n).padStart(2, "0"); }

function formatDateOnly(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = pad2(d.getMinutes());
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60000);
}

function snapTo30(d: Date): Date {
  const out = new Date(d);
  out.setMinutes(Math.ceil(out.getMinutes() / 5) * 5, 0, 0);
  return out;
}

// ── Popular destinations ──────────────────────────────────────────────────────

const POPULAR_DESTS = [
  { name: "Aviva Stadium",    sub: "105 spaces", icon: "🏟️", lat: 53.3352, lng: -6.2285 },
  { name: "Airport",          sub: "312 spaces", icon: "✈️", lat: 53.4264, lng: -6.2499 },
  { name: "Trinity College",  sub: "48 spaces",  icon: "🎓", lat: 53.3458, lng: -6.2597 },
  { name: "Grand Canal Dock", sub: "76 spaces",  icon: "🌊", lat: 53.3396, lng: -6.2319 },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function MobileSearchLanding({
  initialFilters,
  onSearch,
  hideHeader = false,
}: {
  initialFilters: SearchFilters;
  onSearch: (filters: SearchFilters) => void;
  hideHeader?: boolean;
}) {
  const defaultStart = useMemo(() => snapTo30(new Date()), []);
  const defaultEnd   = useMemo(() => addMinutes(defaultStart, 120), [defaultStart]);

  const mode = initialFilters.mode ?? "daily";
  const [monthlyPlan, setMonthlyPlan] = useState<"full_week" | "weekdays" | "any_3_days">(
    initialFilters.monthlyPlan ?? "full_week",
  );
  const [location,  setLocation]  = useState(initialFilters.location ?? "");
  const [latitude,  setLatitude]  = useState(initialFilters.latitude);
  const [longitude, setLongitude] = useState(initialFilters.longitude);
  const [startAt,   setStartAt]   = useState(defaultStart);
  const [endAt,     setEndAt]     = useState(defaultEnd);
  const [pickerOpen, setPickerOpen] = useState<"start" | "end" | null>(null);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  const formatDisplay = (d: Date): string => {
    if (mode === "monthly") return formatDateOnly(d);
    return `${formatDateOnly(d)}, ${formatTime(d)}`;
  };

  const toDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const toTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const handleSubmit = () => {
    if (!location) return;
    if (mode === "monthly") {
      const end = new Date(startAt);
      end.setMonth(end.getMonth() + 1);
      onSearch({ ...initialFilters, location, latitude: latitude ?? initialFilters.latitude, longitude: longitude ?? initialFilters.longitude, mode: "monthly", monthlyPlan, date: toDate(startAt), startTime: "00:00", endDate: toDate(end), endTime: "23:59", radiusKm: 5 });
    } else {
      onSearch({ ...initialFilters, location, latitude: latitude ?? initialFilters.latitude, longitude: longitude ?? initialFilters.longitude, mode: "daily", date: toDate(startAt), startTime: toTime(startAt), endDate: toDate(endAt), endTime: toTime(endAt), radiusKm: 5 });
    }
  };

  const launchDest = (dest: { name: string; lat: number; lng: number }) => {
    onSearch({ ...initialFilters, location: dest.name, latitude: dest.lat, longitude: dest.lng, mode: "daily", date: toDate(startAt), startTime: toTime(startAt), endDate: toDate(endAt), endTime: toTime(endAt), radiusKm: 1 });
  };

  return (
    <div className="flex flex-col bg-white">

      {/* ── HERO — photo + dark scrim ──────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-5 pb-7"
        style={{ paddingTop: hideHeader ? "0" : "calc(env(safe-area-inset-top) + 16px)" }}
      >
        {/* Background photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&q=80"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        {/* Dark overlay scrim */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/65" />

        {/* Content sits above the overlay */}
        <div className="relative pt-7">

        {/* Nav row — only when shown standalone (search page landing) */}
        {!hideHeader && (
          <div className="mb-5 flex items-center justify-between">
            <img
              src="/favicon.png"
              alt="FreeSpace"
              className="h-9 w-auto"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <Link
              href="/login"
              className="rounded-full border border-white/30 px-4 py-1.5 text-[13px] font-semibold text-white/90 transition hover:border-white/60 hover:text-white"
            >
              Log in
            </Link>
          </div>
        )}

        {/* Tagline */}
        <div className="mb-5">
          <p className="text-[27px] font-medium leading-[1.15] tracking-[-0.03em] text-white/70">
            Find parking,
          </p>
          <p className="text-[27px] font-extrabold leading-[1.15] tracking-[-0.03em] text-white">
            book in seconds.
          </p>
        </div>

        {/* ── Search Card ── */}
        <div className="rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">

          {/* Unified form — Booking.com style with dividers */}
          <div className="mx-4 mt-4 overflow-hidden rounded-[14px]" style={{ border: "1.5px solid #DEDEDD" }}>

            {/* Location row */}
            <button
              type="button"
              onClick={() => setLocationSheetOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-slate-50"
            >
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="#0fa968" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#888]">Where</p>
                <p className={`mt-0.5 truncate text-[15px] ${location ? "font-semibold text-[#111]" : "font-normal text-[#ABABAB]"}`}>
                  {location || "City, address or postcode"}
                </p>
              </div>
            </button>

            {/* Horizontal divider */}
            <div style={{ height: "1.5px", background: "#DEDEDD" }} />

            {/* Date / time row */}
            {mode === "monthly" ? (
              <div className="grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPickerOpen("start")}
                  className="flex items-center gap-3 px-4 py-3.5 text-left transition active:bg-slate-50"
                >
                  <svg className="h-[17px] w-[17px] shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#888]">Starting</p>
                    <p className="mt-0.5 text-[13.5px] font-semibold leading-tight text-[#111]">{formatDateOnly(startAt)}</p>
                  </div>
                </button>
                {/* Vertical divider */}
                <div className="relative">
                  <div className="absolute bottom-3 left-0 top-3" style={{ width: "1.5px", background: "#DEDEDD" }} />
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <svg className="h-[17px] w-[17px] shrink-0 text-[#ABABAB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M7 12h5m5 0h-1M7 18h5m5 0h-1" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#888]">Schedule</p>
                      <div className="relative mt-0.5">
                        <select
                          value={monthlyPlan}
                          onChange={(e) => setMonthlyPlan(e.target.value as typeof monthlyPlan)}
                          className="w-full appearance-none bg-transparent text-[14px] font-semibold text-[#111] outline-none"
                        >
                          {MONTHLY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <svg className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#ABABAB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPickerOpen("start")}
                  className="flex items-center gap-3 px-4 py-3.5 text-left transition active:bg-slate-50"
                >
                  <svg className="h-[17px] w-[17px] shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#888]">From</p>
                    <p className="mt-0.5 text-[13.5px] font-semibold leading-tight text-[#111]">{formatDateOnly(startAt)}</p>
                    <p className="text-[12.5px] text-[#555]">{formatTime(startAt)}</p>
                  </div>
                </button>
                {/* Vertical divider + Until field */}
                <div className="relative">
                  <div className="absolute bottom-3 left-0 top-3" style={{ width: "1.5px", background: "#DEDEDD" }} />
                  <button
                    type="button"
                    onClick={() => setPickerOpen("end")}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-slate-50"
                  >
                    <svg className="h-[17px] w-[17px] shrink-0 text-[#ABABAB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#888]">Until</p>
                      <p className="mt-0.5 text-[13.5px] font-semibold leading-tight text-[#111]">{formatDateOnly(endAt)}</p>
                      <p className="text-[12.5px] text-[#555]">{formatTime(endAt)}</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CTA button */}
          <div className="px-4 pb-4 pt-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!location}
              className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[12px] bg-brand-500 text-[15.5px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-40"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              Search parking spaces
            </button>
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-4 flex items-center justify-between px-1 text-[11px] font-medium text-white/55">
          <span>✓ Best price</span>
          <span>✓ Instant booking</span>
          <span>✓ Free cancellation</span>
        </div>
        </div>
      </div>

      {/* ── Popular destinations ──────────────────────────────────────────── */}
      <div className="bg-white pt-5 pb-2">
        <p className="mb-3 px-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9A9A9A]">
          Popular near you
        </p>
        <div
          className="flex gap-2.5 overflow-x-auto pb-1"
          style={{ paddingLeft: 20, paddingRight: 20, scrollbarWidth: "none" }}
        >
          {POPULAR_DESTS.map((dest) => (
            <button
              key={dest.name}
              type="button"
              onClick={() => launchDest(dest)}
              className="flex shrink-0 items-center gap-2.5 rounded-[14px] border border-[#E6E6E4] bg-white px-4 py-3 shadow-sm transition active:scale-[0.97]"
            >
              <span className="text-xl leading-none">{dest.icon}</span>
              <div className="text-left">
                <p className="text-[13px] font-bold text-[#111]">{dest.name}</p>
                <p className="text-[11px] text-[#9A9A9A]">{dest.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── App download ───────────────────────────────────────────────────── */}
      <div className="mt-6 px-5">
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[#111]">
          Download the free<br />FreeSpace app
        </h2>
        <p className="mt-2 text-[14px] leading-[1.5] text-[#6B6B6B]">
          The easiest way to find and book parking near you. Anytime, anywhere.
        </p>
        <div className="mt-4 flex gap-2.5">
          <a
            href="#"
            aria-label="Download on the App Store"
            className="flex items-center gap-2.5 rounded-[11px] bg-[#111] px-4 py-2.5 transition hover:bg-[#2a2a2a]"
          >
            <svg width="18" height="22" viewBox="0 0 20 24" fill="white" aria-hidden="true">
              <path d="M16.462 12.748c-.022-2.637 2.153-3.906 2.252-3.969-1.228-1.794-3.136-2.04-3.812-2.063-1.617-.165-3.173.959-3.993.959-.836 0-2.11-.94-3.475-.913-1.78.027-3.434 1.047-4.347 2.642-1.863 3.228-.475 7.993 1.328 10.609.893 1.282 1.946 2.715 3.32 2.663 1.34-.055 1.843-.858 3.462-.858 1.603 0 2.072.858 3.473.827 1.44-.024 2.35-1.297 3.226-2.588.027-.019.053-.037.078-.058-1.395-.636-2.49-1.991-2.512-4.251zM13.98 4.371c.74-.896 1.24-2.136 1.103-3.371-1.068.044-2.361.711-3.127 1.607-.686.793-1.288 2.07-1.127 3.283 1.194.09 2.413-.605 3.151-1.519z"/>
            </svg>
            <div>
              <p className="text-[9px] leading-none text-white/70">Download on the</p>
              <p className="text-[14px] font-semibold leading-tight text-white">App Store</p>
            </div>
          </a>
          <a
            href="#"
            aria-label="Get it on Google Play"
            className="flex items-center gap-2.5 rounded-[11px] bg-[#111] px-4 py-2.5 transition hover:bg-[#2a2a2a]"
          >
            <svg width="18" height="20" viewBox="0 0 20 22" fill="none" aria-hidden="true">
              <path d="M.5 1.2C.19 1.54.01 2.06.01 2.73v16.54c0 .67.18 1.19.49 1.53l.08.07 9.27-9.27v-.22L.58 1.13.5 1.2z" fill="url(#gp-a)"/>
              <path d="M12.94 14.73l-3.09-3.09v-.22l3.09-3.09.07.04 3.66 2.08c1.05.59 1.05 1.57 0 2.17l-3.66 2.08-.07.03z" fill="url(#gp-b)"/>
              <path d="M13.01 14.7L9.85 11.5.5 20.85c.34.36.91.41 1.54.05l10.97-6.2z" fill="url(#gp-c)"/>
              <path d="M13.01 8.3L2.04 2.1C1.41 1.74.84 1.79.5 2.15l9.35 9.35 3.16-3.2z" fill="url(#gp-d)"/>
              <defs>
                <linearGradient id="gp-a" x1="9.1" y1="2.26" x2="-3.77" y2="15.13" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00A0FF"/><stop offset="1" stopColor="#00FFFF" stopOpacity=".1"/>
                </linearGradient>
                <linearGradient id="gp-b" x1="17.71" y1="11.5" x2="-.08" y2="11.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFD900"/><stop offset="1" stopColor="#FF9000" stopOpacity=".1"/>
                </linearGradient>
                <linearGradient id="gp-c" x1="11.2" y1="13.24" x2="-5.12" y2="29.56" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FF3A44"/><stop offset="1" stopColor="#C31162" stopOpacity=".1"/>
                </linearGradient>
                <linearGradient id="gp-d" x1="-1.84" y1="-3.5" x2="5.64" y2="3.98" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#32A071"/><stop offset="1" stopColor="#2DA771" stopOpacity=".1"/>
                </linearGradient>
              </defs>
            </svg>
            <div>
              <p className="text-[9px] leading-none text-white/70">Get it on</p>
              <p className="text-[14px] font-semibold leading-tight text-white">Google Play</p>
            </div>
          </a>
        </div>
      </div>

      {/* ── List your space ────────────────────────────────────────────────── */}
      <div className="mt-6 px-5">
        <div className="flex items-center justify-between rounded-[14px] border border-[#E6E6E4] bg-white px-4 py-3.5">
          <div>
            <p className="text-[14px] font-semibold text-[#111]">Got a driveway or garage?</p>
            <p className="mt-0.5 text-[12px] text-[#6B6B6B]">Earn up to €2,800 a year</p>
          </div>
          <Link
            href="/host"
            className="ml-4 flex-shrink-0 rounded-full border border-[#D4D4D2] px-3.5 py-1.5 text-[13px] font-semibold text-[#111] transition hover:bg-[#F7F7F6]"
          >
            List a space
          </Link>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-8 border-t border-[#E6E6E4] px-5 py-6">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-[#6B6B6B]">
          {[
            { label: "Find parking", href: "/search" },
            { label: "List a space", href: "/host" },
            { label: "Help",         href: "/help" },
            { label: "Terms",        href: "/legal/terms" },
            { label: "Privacy",      href: "/legal/privacy" },
          ].map((l) => (
            <Link key={l.label} href={l.href as any} className="transition hover:text-[#111]">
              {l.label}
            </Link>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-[#9A9A9A]">© 2026 FreeSpace Ltd</p>
      </footer>

      {/* ── Location search sheet ────────────────────────────────────────────── */}
      <AnimatePresence>
        {locationSheetOpen && (
          <LocationSheet
            key="location-sheet"
            value={location}
            onSelect={(place) => {
              setLocation(place.address);
              setLatitude(place.lat);
              setLongitude(place.lng);
              setLocationSheetOpen(false);
            }}
            onClose={() => setLocationSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Date/time picker sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {pickerOpen && (
          <DateTimeSheet
            key="datetime-sheet"
            field={pickerOpen}
            startAt={startAt}
            endAt={endAt}
            dateOnly={mode === "monthly"}
            onConfirm={(next) => {
              if (pickerOpen === "start") {
                setStartAt(next);
                if (next >= endAt) setEndAt(addMinutes(next, 120));
              } else {
                if (next > startAt) setEndAt(next);
              }
              setPickerOpen(null);
            }}
            onClose={() => setPickerOpen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── LocationSheet ─────────────────────────────────────────────────────────────

function LocationSheet({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (place: PlaceResult) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const svcRef   = useRef<any>(null);
  const plcRef   = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState(value || "");
  const [predictions, setPredictions] = useState<any[]>([]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    if ((window as any).google?.maps?.places) {
      svcRef.current = new (window as any).google.maps.places.AutocompleteService();
      const div = document.createElement("div");
      document.body.appendChild(div);
      plcRef.current = new (window as any).google.maps.places.PlacesService(div);
    }
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    if (!q || !svcRef.current) { setPredictions([]); return; }
    timerRef.current = setTimeout(() => {
      svcRef.current.getPlacePredictions(
        { input: q, componentRestrictions: { country: "ie" } },
        (preds: any[], status: string) => {
          setPredictions(status === "OK" && preds?.length ? preds.slice(0, 6) : []);
        },
      );
    }, 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const pickPrediction = (pred: any) => {
    if (plcRef.current) {
      plcRef.current.getDetails(
        { placeId: pred.place_id, fields: ["geometry", "formatted_address"] },
        (place: any, status: string) => {
          if (status === "OK" && place.geometry?.location) {
            onSelect({ address: place.formatted_address ?? pred.description, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
          } else {
            onSelect({ address: pred.description, lat: 53.3498, lng: -6.2603 });
          }
        },
      );
    } else {
      onSelect({ address: pred.description, lat: 53.3498, lng: -6.2603 });
    }
  };

  const showPopular = query.trim() === "";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      initial={{ y: "100%", opacity: 0.98 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0.98 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-[17px] font-bold text-[#111]">Where are you parking?</h2>
      </div>

      {/* Search input */}
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center gap-3 rounded-[14px] border-2 border-brand-500 bg-[#F9F9F8] px-4 py-3.5">
          <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="#0fa968" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, address or postcode"
            className="flex-1 bg-transparent text-[16px] font-medium text-[#111] outline-none placeholder:font-normal placeholder:text-[#ABABAB]"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#B0B0B0] text-white"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {showPopular ? (
          <>
            <p className="px-5 pb-2 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9A9A9A]">
              Popular near you
            </p>
            {POPULAR_DESTS.map((dest) => (
              <button
                key={dest.name}
                type="button"
                onClick={() => onSelect({ address: dest.name, lat: dest.lat, lng: dest.lng })}
                className="flex w-full items-center gap-4 border-b border-slate-100 px-5 py-4 text-left transition active:bg-slate-50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[20px] leading-none">
                  {dest.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[#111]">{dest.name}</p>
                  <p className="text-[13px] text-[#6B6B6B]">{dest.sub}</p>
                </div>
                <svg className="h-4 w-4 shrink-0 text-[#CACACA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </>
        ) : predictions.length > 0 ? (
          predictions.map((pred) => {
            const main = pred.structured_formatting?.main_text ?? pred.description;
            const secondary = pred.structured_formatting?.secondary_text ?? "";
            return (
              <button
                key={pred.place_id}
                type="button"
                onClick={() => pickPrediction(pred)}
                className="flex w-full items-center gap-4 border-b border-slate-100 px-5 py-4 text-left transition active:bg-slate-50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <svg className="h-5 w-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[#111]">{main}</p>
                  {secondary && <p className="truncate text-[13px] text-[#6B6B6B]">{secondary}</p>}
                </div>
              </button>
            );
          })
        ) : (
          <button
            type="button"
            onClick={() => onSelect({ address: query.trim(), lat: 53.3498, lng: -6.2603 })}
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition active:bg-slate-50"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[#111]">Search &quot;{query}&quot;</p>
              <p className="text-[13px] text-[#6B6B6B]">Use as parking location</p>
            </div>
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── DateTimeSheet ─────────────────────────────────────────────────────────────

function DateTimeSheet({
  field, startAt, endAt, dateOnly = false, onConfirm, onClose,
}: {
  field: "start" | "end";
  startAt: Date;
  endAt: Date;
  dateOnly?: boolean;
  onConfirm: (d: Date) => void;
  onClose: () => void;
}) {
  const current = field === "start" ? startAt : endAt;
  const [draft, setDraft] = useState(current);
  const [viewYear, setViewYear] = useState(current.getFullYear());
  const [viewMonth, setViewMonth] = useState(current.getMonth());

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const minDay = field === "end"
    ? (() => { const d = new Date(startAt); d.setHours(0, 0, 0, 0); return d; })()
    : today;

  const calDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(viewYear, viewMonth, d));
    return cells;
  }, [viewYear, viewMonth]);

  const timeValue = `${pad2(draft.getHours())}:${pad2(draft.getMinutes())}`;
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      initial={{ y: "100%", opacity: 0.98 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0.98 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
    >
      <motion.button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <div className="relative z-10 flex h-full flex-col bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[18px] font-semibold text-[#0f172a]">{field === "start" ? "Park from" : "Park until"}</h2>
          <button type="button" onClick={onClose} className="text-[14px] font-semibold text-brand-500">Cancel</button>
        </div>
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="text-[14px] font-semibold text-[#1F2937]">{MONTHS_LONG[viewMonth]} {viewYear}</span>
          <div className="flex items-center gap-3 text-brand-500">
            <button type="button" onClick={prevMonth} className="p-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button type="button" onClick={nextMonth} className="p-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
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
                onClick={() => { const next = new Date(day); next.setHours(draft.getHours(), draft.getMinutes(), 0, 0); setDraft(next); }}
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition
                  ${isSelected ? "font-semibold text-white" :
                    isToday ? "font-semibold" :
                    isDisabled ? "text-[#C7CDD8]" :
                    "font-medium text-[#0f172a] active:bg-[#F1F5F9]"}`}
                style={
                  isSelected ? { background: "#0fa968" }
                  : isToday ? { border: "1.5px solid #0fa968", color: "#0fa968" }
                  : {}
                }
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
        <div className="mt-auto flex items-center gap-3 border-t border-[#EEF2F7] px-5 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          {!dateOnly && (
            <>
              <span className="text-[13px] text-[#6B7280]">{field === "start" ? "Enter after" : "Leave by"}</span>
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
            </>
          )}
          <button
            type="button"
            onClick={() => onConfirm(draft)}
            className="ml-auto rounded-xl px-6 py-2.5 text-[14px] font-semibold text-white"
            style={{ background: "#0fa968" }}
          >
            Done
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#0f172a] shadow-sm transition focus:outline-none"
        aria-label="Select time"
      >
        <Select.Value />
        <Select.Icon className="text-brand-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-[60] rounded-2xl border border-slate-200 bg-white shadow-2xl" position="popper" sideOffset={8}>
          <Select.Viewport className="max-h-[60vh] overflow-y-auto p-2">
            {TIME_SLOTS.map((t) => (
              <Select.Item
                key={t}
                value={t}
                className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50 data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-700"
              >
                <Select.ItemText>{t}</Select.ItemText>
                <Select.ItemIndicator className="text-brand-500">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
