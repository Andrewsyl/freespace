"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
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
  out.setMinutes(Math.ceil(out.getMinutes() / 30) * 30, 0, 0);
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
    body: "Pick your destination, compare spaces, and filter by what actually matters to your trip.",
  },
  {
    title: "Book",
    body: "Reserve in seconds with upfront pricing, clear instructions, and instant confirmation.",
  },
  {
    title: "Park",
    body: "Arrive with the details you need, follow the access steps, and get on with your day.",
  },
] as const;

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

  const submit = () => {
    if (!location.trim()) {
      setLocationError(true);
      return;
    }
    setLocationError(false);
    handleSearch({
      ...defaultFilters,
      location,
      latitude: latitude ?? defaultFilters.latitude,
      longitude: longitude ?? defaultFilters.longitude,
      date,
      startTime: mode === "monthly" ? "00:00" : startTime,
      endDate: mode === "monthly" ? addMonths(date, 1) : defaultFilters.endDate,
      endTime: mode === "monthly" ? "23:59" : endTime,
      monthlyPlan: mode === "monthly" ? monthlyPlan : undefined,
      mode,
    });
  };

  const launchScenario = (overrides: Partial<SearchFilters>) => {
    handleSearch({
      ...defaultFilters,
      ...overrides,
      location: overrides.location ?? defaultFilters.location,
      latitude: overrides.latitude ?? defaultFilters.latitude,
      longitude: overrides.longitude ?? defaultFilters.longitude,
      mode: overrides.mode ?? defaultFilters.mode,
      evCharging: overrides.evCharging,
    });
  };

  return (
    <div className="min-h-[100dvh] bg-white">
      <SlimNav />


      <main className="mx-auto w-full max-w-6xl px-6 py-8 sm:py-12">
        {/* ── Hero ── */}
        <section className="grid lg:grid-cols-[1fr_460px] gap-8 lg:gap-14 items-center">
          <div>
            <h1 className="font-display tracking-tight">
              <span className="block text-[30px] font-medium leading-[1.06] text-slate-800 sm:text-[40px] lg:text-[58px]">The smarter way to</span>
              <span className="block text-[30px] font-extrabold leading-[1.06] text-brand-500 sm:text-[40px] lg:text-[58px]">find parking.</span>
            </h1>
            <p className="mt-5 max-w-[380px] text-[15px] leading-relaxed text-slate-500">
              Search thousands of trusted spaces. Compare great prices and book instantly — no stress, no surprises.
            </p>

            {/* ── Mobile search card (phones only) ── */}
            <div className="mt-8 sm:hidden rounded-3xl bg-white shadow-[0_4px_32px_rgba(0,0,0,0.14)] ring-1 ring-slate-900/[0.10]">
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
              <div className="space-y-3 p-4">
                <div className="overflow-hidden rounded-2xl border border-slate-300">
                  {/* WHERE */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <svg className="h-[18px] w-[18px] shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">Where</p>
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
                      />
                      {locationError && <p className="mt-0.5 text-[11px] font-medium text-brand-600">Enter a location first</p>}
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
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">{mode === "monthly" ? "Starting" : "From"}</p>
                            <p className="mt-0.5 text-[13.5px] font-semibold leading-tight text-slate-900">{formatDateShort(startDateTime)}</p>
                            {mode !== "monthly" && <p className="text-[12px] text-slate-500">{formatTimeAMPM(startDateTime)}</p>}
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
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">Schedule</p>
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
                                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">Until</p>
                                <p className="mt-0.5 text-[13.5px] font-semibold leading-tight text-slate-900">{formatDateShort(endDateTime)}</p>
                                <p className="text-[12px] text-slate-500">{formatTimeAMPM(endDateTime)}</p>
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
                  className="font-display flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-4 text-[15px] font-bold text-white transition hover:bg-brand-600"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  Search parking spaces
                </button>
              </div>
            </div>

            {/* ── Desktop search card (sm and above) ── */}
            <div className="mt-8 hidden sm:block rounded-3xl bg-white shadow-[0_4px_32px_rgba(0,0,0,0.14)] ring-1 ring-slate-900/[0.10]">
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
              <div className="space-y-3 p-5">
                {/* Location */}
                <div className={`rounded-xl border bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition ${locationError ? "border-brand-300" : "border-[#d5dbe3]"}`}>
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
                  />
                </div>

                {/* From + Until/Plan */}
                <div className="grid grid-cols-2 gap-3">
                  <SearchDateTimePicker
                    label="From"
                    value={startDateTime}
                    onChange={(next) => {
                      setDate(next.toISOString().split("T")[0]);
                      setStartTime(mode === "monthly" ? "00:00" : toTimeString(next));
                    }}
                    dateOnly={mode === "monthly"}
                  />
                  {mode === "monthly" ? (
                    <div className="relative flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 shadow-sm">
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
                  className="font-display flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-4 text-[15px] font-bold text-white transition hover:bg-brand-600 hover:shadow-[0_8px_24px_rgba(27,138,90,0.35)]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  Search parking spaces
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 pt-5">
              {[
                { stat: "Instant", label: "Booking" },
                { stat: "Flexible", label: "Cancellation" },
                { stat: "Secure", label: "Payments" },
              ].map((item, i) => (
                <div key={item.stat} className={i === 0 ? "pr-4" : i === 1 ? "px-4" : "pl-4"}>
                  <p className="font-display text-sm font-extrabold text-slate-900">{item.stat}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden h-[520px] overflow-hidden lg:block">
            <Image
              src="/hero-art.png"
              alt="Person using phone with car"
              fill
              priority
              sizes="(min-width: 1024px) 460px, 0px"
              className="object-contain"
            />
          </div>
        </section>

        {/* ── Ways to park — bento grid ── */}
        <section className="mt-10 sm:mt-16">
          <div className="mb-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">Ways to park</p>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Parking for every kind of trip
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">

            {/* Monthly — brand green, 2/3 at lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[0].filters)}
              className="group relative col-span-2 overflow-hidden flex min-h-[200px] flex-col justify-between rounded-3xl bg-brand-600 px-6 py-6 text-left transition hover:bg-brand-700 lg:min-h-[220px] lg:px-8 lg:py-8"
            >
              <svg className="pointer-events-none absolute -right-6 -top-6 h-44 w-44 text-white/[0.07]" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
              </svg>
              <div className="relative flex items-start justify-between gap-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-200/70">{homepageScenarios[0].title}</p>
                <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white/90">from €80/mo</span>
              </div>
              <div className="relative">
                <h3 className="font-display text-2xl font-bold text-white lg:text-3xl">{homepageScenarios[0].title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-brand-100/70">{homepageScenarios[0].body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-200 transition group-hover:gap-3">
                  {homepageScenarios[0].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>

            {/* Airport — warm cream, 1/3 at lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[1].filters)}
              className="group relative overflow-hidden flex min-h-[200px] flex-col justify-between rounded-3xl bg-[#FBF8F2] px-5 py-5 text-left transition hover:bg-[#F4EFE5] lg:min-h-[220px] lg:px-6 lg:py-6"
            >
              <svg className="pointer-events-none absolute -right-5 -top-5 h-32 w-32 text-amber-400/20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
              <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-amber-700/70">{homepageScenarios[1].title}</p>
              <div className="relative">
                <h3 className="font-display text-lg font-bold text-slate-900 lg:text-xl">{homepageScenarios[1].title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600 lg:text-[13px]">{homepageScenarios[1].body}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 transition group-hover:gap-3">
                  {homepageScenarios[1].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>

            {/* Event — cool indigo-tinted, 1/3 at lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[2].filters)}
              className="group relative overflow-hidden flex min-h-[200px] flex-col justify-between rounded-3xl bg-[#F0F2FA] px-5 py-5 text-left transition hover:bg-[#E7EAF5] lg:min-h-[220px] lg:px-6 lg:py-6"
            >
              <svg className="pointer-events-none absolute -right-5 -top-5 h-32 w-32 text-indigo-400/20" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
              </svg>
              <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-500/80">{homepageScenarios[2].title}</p>
              <div className="relative">
                <h3 className="font-display text-lg font-bold text-slate-900 lg:text-xl">{homepageScenarios[2].title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600 lg:text-[13px]">{homepageScenarios[2].body}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 transition group-hover:gap-3">
                  {homepageScenarios[2].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>

            {/* EV charging — dark, 2/3 at lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[3].filters)}
              className="group relative col-span-2 overflow-hidden flex min-h-[200px] flex-col justify-between rounded-3xl bg-slate-900 px-6 py-6 text-left transition hover:bg-slate-800 lg:min-h-[220px] lg:px-8 lg:py-8"
            >
              <svg className="pointer-events-none absolute -right-4 -top-4 h-44 w-44 text-brand-500/[0.13]" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
              </svg>
              <div className="relative flex items-start justify-between gap-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{homepageScenarios[3].title}</p>
                <span className="shrink-0 rounded-full bg-brand-500/20 px-3 py-1 text-[11px] font-bold text-brand-400">EV friendly</span>
              </div>
              <div className="relative">
                <h3 className="font-display text-2xl font-bold text-white lg:text-3xl">{homepageScenarios[3].title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{homepageScenarios[3].body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-slate-300 transition group-hover:gap-3">
                  {homepageScenarios[3].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>

          </div>
        </section>

        {/* ── How it works — editorial numbered ── */}
        <section className="mt-10 pb-10 sm:mt-16 sm:pb-16">
          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">How it works</p>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Search, book, park
            </h2>
          </div>
          <div>
            {howItWorks.map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-8 border-b border-slate-200 py-8 last:border-0"
              >
                <span className="w-12 shrink-0 select-none font-display text-[56px] font-extrabold leading-none text-slate-300 sm:w-16 sm:text-[72px]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="pt-3">
                  <h3 className="font-display text-xl font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
