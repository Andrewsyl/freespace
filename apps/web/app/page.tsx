"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { SearchDateTimePicker, type SearchFilters } from "../components/SearchForm";
import { SlimNav } from "../components/SlimNav";
import { SiteFooter } from "../components/SiteFooter";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function roundUpToHalfHour(d: Date): Date {
  const out = new Date(d);
  out.setMinutes(Math.ceil(out.getMinutes() / 5) * 5, 0, 0);
  return out;
}

function toTimeString(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toDateString(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateShort(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function formatTimeAMPM(d: Date): string {
  const h = d.getHours();
  const m = pad2(d.getMinutes());
  return `${h % 12 || 12}:${m} ${h >= 12 ? "pm" : "am"}`;
}

function addMonths(date: string, count: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setMonth(d.getMonth() + count);
  return toDateString(d);
}

async function geocodeTypedLocation(address: string): Promise<{ address: string; lat: number; lng: number } | null> {
  if (!(window as any).google?.maps?.Geocoder) return null;
  return new Promise((resolve) => {
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode({ address, componentRestrictions: { country: "IE" } }, (results: any[], status: string) => {
      const first = results?.[0];
      if (status === "OK" && first?.geometry?.location) {
        resolve({
          address: first.formatted_address ?? address,
          lat: first.geometry.location.lat(),
          lng: first.geometry.location.lng(),
        });
        return;
      }
      resolve(null);
    });
  });
}

const now = roundUpToHalfHour(new Date());
const defaultEnd = new Date(now.getTime() + 120 * 60000);
const defaultFilters: SearchFilters = {
  location: "",
  date: toDateString(now),
  endDate: toDateString(defaultEnd),
  startTime: toTimeString(now),
  endTime: toTimeString(defaultEnd),
  radiusKm: 5,
  latitude: undefined,
  longitude: undefined,
  mode: "daily",
};

const homepageScenarios = [
  {
    title: "Monthly parking",
    body: "Lock in a regular space near home, work, or your weekday commute.",
    cta: "Browse monthly",
    filters: {
      location: "City Centre",
      latitude: 53.3498,
      longitude: -6.2603,
      mode: "monthly" as const,
    },
  },
  {
    title: "Airport parking",
    body: "Book ahead for early departures, weekend trips, and longer stays.",
    cta: "Near the airport",
    filters: {
      location: "Airport",
      latitude: 53.4264,
      longitude: -6.2499,
      mode: "daily" as const,
    },
  },
  {
    title: "Event parking",
    body: "Get closer to stadiums, gigs, and matchday venues before the rush.",
    cta: "Find event parking",
    filters: {
      location: "Aviva Stadium",
      latitude: 53.3352,
      longitude: -6.2285,
      mode: "daily" as const,
    },
  },
  {
    title: "EV charging",
    body: "Search spaces with charging so parking and topping up happen in one stop.",
    cta: "Spaces with EV",
    filters: {
      location: "City Centre",
      latitude: 53.3498,
      longitude: -6.2603,
      mode: "daily" as const,
      evCharging: true,
    },
  },
] as const;

const howItWorks = [
  {
    title: "Search",
    body: "Find private spaces near where you're headed — real photos, access details, and the exact price, all upfront.",
  },
  {
    title: "Book",
    body: "Reserve in seconds and pay securely with Stripe. Your space is confirmed instantly and saved just for you.",
  },
  {
    title: "Park",
    body: "Pull up to clear directions and head straight in. Your space is ready and waiting.",
  },
] as const;

// Honest trust signals — every claim maps to a real mechanism (Stripe payments,
// upfront pricing in the booking flow, the published cancellation policy).
const trustSignals = [
  {
    label: "Payments secured by Stripe",
    icon: (
      <svg className="h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
  },
  {
    label: "Upfront pricing",
    icon: (
      <svg className="h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.59 11l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z" /><circle cx="7.5" cy="7.5" r="1" />
      </svg>
    ),
  },
  {
    label: "Flexible cancellation",
    icon: (
      <svg className="h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

// Structural truths about the product — benefit-led, not statistics. Framed
// around what FreeSpace gives the driver, not against car parks (car parks are
// a listable space type, so the copy must not disparage them).
const whyFreespace = [
  {
    title: "Reserved just for you",
    body: "Your spot is booked and waiting — no circling, no luck involved.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 4 5v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V5l-8-3z" /><path d="m9 11 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Right where you're headed",
    body: "Private driveways and spaces tucked into the streets you're actually going to — often steps from the door.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    title: "What you see is what you pay",
    body: "Clear, upfront pricing with no hourly meter and no surprises when you leave.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.59 11l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z" /><circle cx="7.5" cy="7.5" r="1" />
      </svg>
    ),
  },
  {
    title: "Pay securely, stay flexible",
    body: "Payments are handled by Stripe, with flexible cancellation if your plans change.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"daily" | "monthly">("daily");
  const [location, setLocation] = useState(defaultFilters.location);
  const [latitude, setLatitude] = useState<number | undefined>(defaultFilters.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(defaultFilters.longitude);
  const [date, setDate] = useState(() => defaultFilters.date);
  const [startTime, setStartTime] = useState(defaultFilters.startTime);
  const [endTime, setEndTime] = useState(defaultFilters.endTime);
  const [monthlyPlan, setMonthlyPlan] = useState<NonNullable<SearchFilters["monthlyPlan"]>>("full_week");
  const [locationError, setLocationError] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);

  const startDateTime = useMemo(() => new Date(`${date}T${startTime}:00`), [date, startTime]);
  const endDateTime = useMemo(() => new Date(`${date}T${endTime}:00`), [date, endTime]);

  const handleSearch = (filters: SearchFilters) => {
    const params = new URLSearchParams({
      location: filters.location,
      date: filters.date,
      startTime: filters.startTime,
      endTime: filters.endTime,
      radiusKm: String(filters.radiusKm),
      mode: filters.mode ?? "daily",
    });
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.monthlyPlan) params.set("monthlyPlan", filters.monthlyPlan);
    if (filters.latitude !== undefined) params.set("lat", String(filters.latitude));
    if (filters.longitude !== undefined) params.set("lng", String(filters.longitude));
    router.push(`/search?${params.toString()}`);
  };

  const submit = async () => {
    const trimmedLocation = location.trim();
    if (!trimmedLocation) {
      setLocationError(true);
      return;
    }
    setResolvingLocation(true);
    setLocationError(false);
    let nextLocation = trimmedLocation;
    let nextLatitude = latitude;
    let nextLongitude = longitude;
    if (nextLatitude === undefined || nextLongitude === undefined) {
      const resolved = await geocodeTypedLocation(trimmedLocation);
      if (!resolved) {
        setLocationError(true);
        setResolvingLocation(false);
        return;
      }
      nextLocation = resolved.address;
      nextLatitude = resolved.lat;
      nextLongitude = resolved.lng;
      setLocation(resolved.address);
      setLatitude(resolved.lat);
      setLongitude(resolved.lng);
    }
    setResolvingLocation(false);
    handleSearch({
      ...defaultFilters,
      location: nextLocation,
      latitude: nextLatitude,
      longitude: nextLongitude,
      date,
      startTime: mode === "monthly" ? "00:00" : startTime,
      endDate: mode === "monthly" ? addMonths(date, 1) : defaultFilters.endDate,
      endTime: mode === "monthly" ? "23:59" : endTime,
      monthlyPlan: mode === "monthly" ? monthlyPlan : undefined,
      mode,
    });
  };

  const launchScenario = (overrides: Partial<SearchFilters>) => {
    // If the scenario has its own destination (e.g. Airport), use it.
    // Otherwise inherit whatever the user has already typed in the search form.
    const hasScenarioLocation = overrides.latitude !== undefined && overrides.longitude !== undefined;
    handleSearch({
      ...defaultFilters,
      ...overrides,
      location: hasScenarioLocation ? (overrides.location ?? defaultFilters.location) : (location || overrides.location || defaultFilters.location),
      latitude: hasScenarioLocation ? overrides.latitude : (latitude ?? overrides.latitude ?? defaultFilters.latitude),
      longitude: hasScenarioLocation ? overrides.longitude : (longitude ?? overrides.longitude ?? defaultFilters.longitude),
      mode: overrides.mode ?? defaultFilters.mode,
      evCharging: overrides.evCharging,
    });
  };

  return (
    <div className="min-h-[100dvh] bg-white antialiased [text-rendering:optimizeLegibility]">
      <SlimNav />


      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-16">
        {/* ── Hero ── */}
        <section className="grid lg:grid-cols-[1fr_460px] gap-8 lg:gap-14 items-center">
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">Parking, sorted</p>
            <h1 className="font-display text-[33px] font-extrabold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-[42px] lg:text-[46px]">
              Skip the search.{" "}
              <span className="text-brand-600">Book a space that&apos;s yours.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-[1.6] text-slate-500">
              Book a private space near your destination, reserved before you arrive.
            </p>

            {/* ── Mobile search card (phones only) ── */}
            <div className="mt-9 overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_70px_-26px_rgba(15,23,42,0.45),0_3px_12px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.08] sm:hidden">
              <div className="flex border-b border-slate-200 px-6">
                {(["daily", "monthly"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`font-display flex-1 -mb-px border-b-2 py-4 text-sm font-bold transition ${
                      mode === value
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    {value === "daily" ? "Hourly / Daily" : "Monthly"}
                  </button>
                ))}
              </div>
              <div className="space-y-3 bg-slate-50/65 p-4">
                <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white">
                  {/* WHERE */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <svg className="h-[18px] w-[18px] shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-600">Where</p>
                      <AddressAutocomplete
                        defaultValue={location}
                        placeholder="City, address or postcode"
                        inputClassName={`mt-0.5 w-full bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-slate-400 ${locationError ? "text-brand-600 placeholder:text-brand-400" : "text-slate-800"}`}
                        onPlace={(place) => {
                          setLocationError(false);
                          setLocation(place.address);
                          setLatitude(place.lat);
                          setLongitude(place.lng);
                        }}
                        onInputChange={(value) => {
                          setLocationError(false);
                          setLocation(value);
                          setLatitude(undefined);
                          setLongitude(undefined);
                        }}
                      />
                      {locationError && <p className="mt-0.5 text-[11px] font-medium text-brand-600">Choose a suggested location or try a more specific address.</p>}
                    </div>
                  </div>

                  <div className="border-t border-slate-300" />

                  {/* FROM + UNTIL/PLAN */}
                  <div className="grid grid-cols-2">
                    {/* FROM */}
                    <SearchDateTimePicker
                      label="From"
                      value={startDateTime}
                      dateOnly={mode === "monthly"}
                      portalPopup
                      onChange={(next) => {
                        setDate(next.toISOString().split("T")[0]);
                        setStartTime(mode === "monthly" ? "00:00" : toTimeString(next));
                      }}
                      renderTrigger={({ toggle }) => (
                        <button
                          type="button"
                          onClick={toggle}
                          className="flex w-full h-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-slate-50"
                        >
                          <svg className="h-[17px] w-[17px] shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-600">{mode === "monthly" ? "Starting" : "From"}</p>
                            <p className="mt-0.5 text-[13.5px] font-semibold leading-tight text-slate-900">{formatDateShort(startDateTime)}</p>
                            {mode !== "monthly" && <p className="text-[12px] text-slate-600">{formatTimeAMPM(startDateTime)}</p>}
                          </div>
                        </button>
                      )}
                    />

                    {/* UNTIL / PLAN */}
                    <div className="relative border-l border-slate-300">
                      {mode === "monthly" ? (
                        <label className="flex h-full cursor-pointer items-center gap-3 px-4 py-3.5">
                          <svg className="h-[17px] w-[17px] shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M7 12h5m5 0h-1M7 18h5" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-600">Schedule</p>
                            <div className="relative mt-0.5">
                              <select
                                value={monthlyPlan}
                                onChange={(e) => setMonthlyPlan(e.target.value as NonNullable<SearchFilters["monthlyPlan"]>)}
                                className="w-full appearance-none bg-transparent text-[13.5px] font-semibold leading-tight text-slate-900 outline-none"
                              >
                                <option value="full_week">Everyday</option>
                                <option value="weekdays">Mon – Fri</option>
                                <option value="any_3_days">Any 3 days</option>
                              </select>
                              <svg className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </label>
                      ) : (
                        <SearchDateTimePicker
                          label="Until"
                          value={endDateTime}
                          portalPopup
                          onChange={(next) => {
                            setDate(next.toISOString().split("T")[0]);
                            setEndTime(toTimeString(next));
                          }}
                          renderTrigger={({ toggle }) => (
                            <button
                              type="button"
                              onClick={toggle}
                              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-slate-50"
                            >
                              <svg className="h-[17px] w-[17px] shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              <div className="min-w-0">
                                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-600">Until</p>
                                <p className="mt-0.5 text-[13.5px] font-semibold leading-tight text-slate-900">{formatDateShort(endDateTime)}</p>
                                <p className="text-[12px] text-slate-600">{formatTimeAMPM(endDateTime)}</p>
                              </div>
                            </button>
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={submit}
                  disabled={resolvingLocation}
                  className="font-display flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-4 text-[15px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  {resolvingLocation ? "Finding location..." : "Search"}
                </button>
              </div>
            </div>

            {/* ── Desktop search card (sm and above) ── */}
            <div className="mt-8 hidden overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_70px_-26px_rgba(15,23,42,0.45),0_3px_12px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.08] sm:block">
              <div className="flex border-b border-slate-200 px-6">
                {(["daily", "monthly"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`font-display flex-1 -mb-px border-b-2 py-4 text-sm font-bold transition ${
                      mode === value
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    {value === "daily" ? "Hourly / Daily" : "Monthly"}
                  </button>
                ))}
              </div>
              <div className="space-y-3 bg-slate-50/65 p-5">
                {/* Location */}
                <div className={`rounded-xl border bg-white px-4 py-2.5 transition ${locationError ? "border-brand-300" : "border-slate-300"}`}>
                  <p className={`text-[11px] font-semibold ${locationError ? "text-brand-600" : "text-brand-600"}`}>
                    {locationError ? "Enter a location to search" : "Where"}
                  </p>
                  <AddressAutocomplete
                    defaultValue={location}
                    placeholder="Enter a location"
                    inputClassName="mt-0.5 w-full bg-transparent text-[16px] font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                    onPlace={(place) => {
                      setLocationError(false);
                      setLocation(place.address);
                      setLatitude(place.lat);
                      setLongitude(place.lng);
                    }}
                    onInputChange={(value) => {
                      setLocationError(false);
                      setLocation(value);
                      setLatitude(undefined);
                      setLongitude(undefined);
                    }}
                  />
                </div>

                {/* From + Until/Plan */}
                <div className="grid grid-cols-2 gap-3">
                  <SearchDateTimePicker
                    label="From"
                    value={startDateTime}
                    flatTrigger
                    onChange={(next) => {
                      setDate(next.toISOString().split("T")[0]);
                      setStartTime(mode === "monthly" ? "00:00" : toTimeString(next));
                    }}
                    dateOnly={mode === "monthly"}
                  />
                  {mode === "monthly" ? (
                    <div className="relative flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-brand-600">Schedule</span>
                        <span className="tabular-nums text-[13px] font-bold text-slate-900">
                          {monthlyPlan === "full_week" ? "Everyday" : monthlyPlan === "weekdays" ? "Mon – Fri" : "Any 3 days"}
                        </span>
                      </div>
                      <svg className="pointer-events-none h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                      </svg>
                      <select
                        value={monthlyPlan}
                        onChange={(e) => setMonthlyPlan(e.target.value as NonNullable<SearchFilters["monthlyPlan"]>)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      >
                        <option value="full_week">Everyday</option>
                        <option value="weekdays">Mon – Fri</option>
                        <option value="any_3_days">Any 3 days</option>
                      </select>
                    </div>
                  ) : (
                    <SearchDateTimePicker
                      label="Until"
                      value={endDateTime}
                      flatTrigger
                      onChange={(next) => {
                        setDate(next.toISOString().split("T")[0]);
                        setEndTime(toTimeString(next));
                      }}
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={submit}
                  disabled={resolvingLocation}
                  className="font-display flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-4 text-[15px] font-bold text-white transition hover:bg-brand-600 hover:shadow-[0_8px_24px_rgba(27,138,90,0.35)] disabled:opacity-60"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  {resolvingLocation ? "Finding location..." : "Search"}
                </button>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-slate-200/80 pt-7">
              {trustSignals.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  {item.icon}
                  <span className="text-[12.5px] font-semibold tracking-[-0.005em] text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual (J) — clean photo over a soft dot-grid panel, with a floating sample listing card */}
          <div className="relative hidden h-[540px] lg:block">
            {/* dot-grid accent panel, offset behind to the top-right */}
            <div
              className="absolute right-0 top-0 h-[500px] w-[90%] rounded-3xl bg-brand-50"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(10,128,80,0.16) 1.4px, transparent 1.4px)",
                backgroundSize: "18px 18px",
              }}
            />
            {/* clean rounded photo, offset to the bottom-left */}
            <div className="absolute bottom-0 left-0 h-[500px] w-[88%] overflow-hidden rounded-3xl shadow-[0_24px_60px_-24px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/[0.06]">
              <Image
                src="/hero-photo.jpg"
                alt="A driver, parked and relaxed, ready to get on with their day"
                fill
                priority
                sizes="(min-width: 1024px) 410px, 0px"
                className="object-cover"
                style={{ objectPosition: "50% 74%" }}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent" />
            </div>
            {/* floating sample listing card, breaking out of the bottom-right */}
            <div className="absolute bottom-8 right-[-16px] w-[230px] rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-display text-[13px] font-bold text-slate-900">Driveway · 2 min walk</p>
                  <p className="text-[12px] text-slate-500">Available now</p>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                <span className="font-display text-[18px] font-extrabold text-slate-900">
                  €12<span className="text-[12px] font-semibold text-slate-400">/day</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Why FreeSpace — product benefits ── */}
        <section className="mt-16 sm:mt-24">
          <div className="mb-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">Why FreeSpace</p>
            <h2 className="font-display mt-3 text-[26px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[32px]">
              Your space, ready when you arrive.
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-3xl bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {whyFreespace.map((item) => (
              <div key={item.title} className="bg-white p-7 lg:p-8">
                <div className="text-brand-600">{item.icon}</div>
                <h3 className="font-display mt-6 text-[16px] font-bold leading-snug tracking-[-0.01em] text-slate-900">{item.title}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-slate-500">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Ways to park — bento grid ── */}
        <section className="mt-16 sm:mt-24">
          <div className="mb-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">Ways to park</p>
            <h2 className="font-display mt-3 text-[26px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[32px]">
              Wherever the day takes you
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">

            {/* Monthly — brand green, 2/3 at lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[0].filters)}
              className="group relative col-span-2 overflow-hidden flex min-h-[200px] flex-col justify-between rounded-3xl bg-brand-600 px-6 py-6 text-left transition hover:bg-brand-700 lg:min-h-[220px] lg:px-7 lg:py-7"
            >
              <svg className="pointer-events-none absolute -right-6 -top-6 h-44 w-44 text-white/[0.07]" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
              </svg>
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-100/80">{homepageScenarios[0].title}</p>
              </div>
              <div className="relative">
                <h3 className="font-display text-2xl font-bold text-white lg:text-3xl">{homepageScenarios[0].title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-brand-50/85">{homepageScenarios[0].body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white transition group-hover:gap-3">
                  {homepageScenarios[0].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>

            {/* Airport — warm cream, 1/3 at lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[1].filters)}
              className="group relative overflow-hidden flex min-h-[200px] flex-col justify-between rounded-3xl bg-[#FBF8F2] px-6 py-6 text-left transition hover:bg-[#F4EFE5] lg:min-h-[220px] lg:px-7 lg:py-7"
            >
              <svg className="pointer-events-none absolute -right-5 -top-5 h-32 w-32 text-amber-400/20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
              <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-amber-800/75">{homepageScenarios[1].title}</p>
              <div className="relative">
                <h3 className="font-display text-xl font-bold text-slate-950">{homepageScenarios[1].title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">{homepageScenarios[1].body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-amber-800 transition group-hover:gap-3">
                  {homepageScenarios[1].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>

            {/* Event — cool indigo-tinted, 1/3 at lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[2].filters)}
              className="group relative overflow-hidden flex min-h-[200px] flex-col justify-between rounded-3xl bg-[#F0F2FA] px-6 py-6 text-left transition hover:bg-[#E7EAF5] lg:min-h-[220px] lg:px-7 lg:py-7"
            >
              <svg className="pointer-events-none absolute -right-5 -top-5 h-32 w-32 text-indigo-400/20" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
              </svg>
              <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-700/75">{homepageScenarios[2].title}</p>
              <div className="relative">
                <h3 className="font-display text-xl font-bold text-slate-950">{homepageScenarios[2].title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">{homepageScenarios[2].body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700 transition group-hover:gap-3">
                  {homepageScenarios[2].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>

            {/* EV charging — dark, 2/3 at lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[3].filters)}
              className="group relative col-span-2 overflow-hidden flex min-h-[200px] flex-col justify-between rounded-3xl bg-slate-900 px-6 py-6 text-left transition hover:bg-slate-800 lg:min-h-[220px] lg:px-7 lg:py-7"
            >
              <svg className="pointer-events-none absolute -right-4 -top-4 h-44 w-44 text-brand-500/[0.13]" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
              </svg>
              <div className="relative flex items-start justify-between gap-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{homepageScenarios[3].title}</p>
                <span className="shrink-0 rounded-full bg-brand-500/20 px-3 py-1 text-[11px] font-bold text-brand-300">EV friendly</span>
              </div>
              <div className="relative">
                <h3 className="font-display text-2xl font-bold text-white lg:text-3xl">{homepageScenarios[3].title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{homepageScenarios[3].body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white transition group-hover:gap-3">
                  {homepageScenarios[3].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>

          </div>
        </section>

        {/* ── How it works + safety — editorial numbered ── */}
        <section id="how-it-works" className="mt-16 sm:mt-24">
          <div className="mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">How it works</p>
            <h2 className="font-display mt-3 text-[26px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[32px]">
              Sorted before you set off
            </h2>
          </div>
          <div>
            {howItWorks.map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-8 border-b border-slate-200/80 py-9 last:border-0"
              >
                <span className="w-12 shrink-0 select-none font-display text-[56px] font-extrabold leading-none tracking-tight tabular-nums text-slate-200 sm:w-16 sm:text-[72px]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="pt-2.5">
                  <h3 className="font-display text-[19px] font-bold tracking-[-0.01em] text-slate-900">{step.title}</h3>
                  <p className="mt-2 max-w-xl text-[15px] leading-[1.65] text-slate-600">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Become a host — supply lane (last before footer) ── */}
        <section className="mt-16 pb-12 sm:mt-24 sm:pb-20">
          <div className="group relative overflow-hidden rounded-3xl bg-slate-950 px-8 py-10 transition-colors hover:bg-slate-900 sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
            {/* Depth — soft brand glow + decorative glyph, like the scenario cards */}
            <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-brand-500/10 blur-3xl" />
            <svg className="pointer-events-none absolute -right-6 -top-8 h-56 w-56 text-brand-500/[0.10]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
              <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
            </svg>

            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-400">Become a host</p>
              <h2 className="font-display mt-3 text-[26px] font-bold tracking-[-0.02em] text-white sm:text-[32px]">
                Earn from your driveway
              </h2>
              <p className="mt-4 max-w-md text-[15.5px] leading-[1.6] text-slate-300/90">
                Got a spare parking space? List it for free, set your own price, and turn an empty driveway into income.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                {(["Free to list", "You set the price", "Secure Stripe payouts"] as const).map((feat) => (
                  <div key={feat} className="flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                    <span className="text-[13px] font-medium text-slate-300">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative mt-8 shrink-0 lg:mt-0">
              <Link
                href="/host"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-[15px] font-bold text-slate-950 transition hover:bg-slate-100"
              >
                List your space
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
