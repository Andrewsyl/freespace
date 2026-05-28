"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMemo, useState } from "react";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { SearchDateTimePicker, type SearchFilters } from "../components/SearchForm";
import { SlimNav } from "../components/SlimNav";
import { MobileSearchLanding } from "../components/MobileSearchLanding";

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

function addMonths(date: string, count: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setMonth(d.getMonth() + count);
  return d.toISOString().split("T")[0];
}

const now = roundUpToHalfHour(new Date());
const defaultEnd = new Date(now.getTime() + 120 * 60000);
const defaultFilters: SearchFilters = {
  location: "Dublin City Centre",
  date: now.toISOString().split("T")[0],
  endDate: defaultEnd.toISOString().split("T")[0],
  startTime: toTimeString(now),
  endTime: toTimeString(defaultEnd),
  radiusKm: 5,
  latitude: 53.3498,
  longitude: -6.2603,
  mode: "daily",
};

const homepageScenarios = [
  {
    title: "Monthly parking",
    body: "Lock in a regular space near home, work, or your weekday commute.",
    cta: "Browse monthly",
    filters: {
      location: "Dublin City Centre",
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
      location: "Dublin Airport",
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
      location: "Aviva Stadium, Dublin",
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
      location: "Dublin City Centre",
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
    if (!location.trim()) return;
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
        {/* ── Mobile ── */}
        <section className="block sm:hidden -mx-6 -mt-8">
          <MobileSearchLanding
            initialFilters={defaultFilters}
            onSearch={(filters) => handleSearch(filters)}
            hideHeader
          />
        </section>

        {/* ── Desktop hero ── */}
        <section className="hidden sm:grid lg:grid-cols-[1fr_460px] gap-8 lg:gap-14 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500 mb-5">Dublin · Ireland</p>
            <h1 className="font-display tracking-tight">
              <span className="block text-[40px] font-medium leading-[1.06] text-slate-800 lg:text-[58px]">The smarter way to</span>
              <span className="block text-[40px] font-extrabold leading-[1.06] text-brand-500 lg:text-[58px]">find parking.</span>
            </h1>
            <p className="mt-5 max-w-[380px] text-[15px] leading-relaxed text-slate-500">
              Search thousands of trusted spaces across Dublin. Compare prices and book instantly — no stress, no surprises.
            </p>

            {/* Search card — shadow depth, no heavy border */}
            <div className="mt-8 overflow-hidden rounded-3xl bg-white shadow-[0_4px_32px_rgba(0,0,0,0.09)] ring-1 ring-slate-900/[0.06]">
              <div className="flex border-b border-slate-100 px-6">
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

              <div className="space-y-3 p-6">
                <AddressAutocomplete
                  defaultValue={location}
                  placeholder="Where would you like to park?"
                  inputClassName="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:outline-none"
                  onPlace={(place) => {
                    setLocation(place.address);
                    setLatitude(place.lat);
                    setLongitude(place.lng);
                  }}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 cursor-pointer">
                    <SearchDateTimePicker
                      label="From"
                      inlineLabel={mode === "monthly" ? "Start" : "From"}
                      value={startDateTime}
                      onChange={(next) => {
                        setDate(next.toISOString().split("T")[0]);
                        setStartTime(mode === "monthly" ? "00:00" : toTimeString(next));
                      }}
                      dateOnly={mode === "monthly"}
                    />
                  </label>
                  {mode === "monthly" ? (
                    <label className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 cursor-pointer">
                      <span className="text-[11px] text-slate-400">Plan</span>
                      <div className="relative">
                        <select
                          value={monthlyPlan}
                          onChange={(event) => setMonthlyPlan(event.target.value as NonNullable<SearchFilters["monthlyPlan"]>)}
                          className="w-full appearance-none bg-transparent px-1 py-1 text-sm font-semibold text-slate-800 outline-none"
                        >
                          <option value="full_week">Everyday</option>
                          <option value="weekdays">Mon - Fri only</option>
                          <option value="any_3_days">Any 3 days</option>
                        </select>
                        <svg className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </label>
                  ) : (
                    <label className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 cursor-pointer">
                      <SearchDateTimePicker
                        label="Until"
                        value={endDateTime}
                        onChange={(next) => {
                          setDate(next.toISOString().split("T")[0]);
                          setEndTime(toTimeString(next));
                        }}
                      />
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  onClick={submit}
                  className="font-display flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-4 text-[15px] font-bold text-white transition hover:bg-brand-600 hover:shadow-[0_8px_24px_rgba(27,138,90,0.35)]"
                >
                  Find parking spaces
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              {["Best price guarantee", "Trusted by thousands", "Flexible cancellation"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t}
                </span>
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

        {/* ── Stats strip ── */}
        <div className="mt-12 hidden sm:grid sm:grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-7">
          {[
            { stat: "5,000+", label: "Spaces listed across Dublin" },
            { stat: "Instant", label: "Booking confirmation" },
            { stat: "Best price", label: "Guarantee on every space" },
          ].map((item) => (
            <div key={item.stat} className="px-6 first:pl-0 last:pr-0 lg:px-10">
              <p className="font-display text-xl font-extrabold text-slate-900 lg:text-2xl">{item.stat}</p>
              <p className="mt-0.5 text-sm text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        {/* ── Ways to park — bento grid ── */}
        <section className="mt-16 hidden sm:block">
          <div className="mb-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">Ways to park</p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Parking for every kind of trip
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {/* Monthly — large, brand green — full width sm, 2/3 lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[0].filters)}
              className="group col-span-2 flex min-h-[160px] flex-col justify-between rounded-3xl bg-brand-600 px-6 py-6 text-left transition hover:bg-brand-700 lg:min-h-[180px] lg:px-8 lg:py-7"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-200/70">{homepageScenarios[0].title}</p>
              <div>
                <h3 className="font-display text-xl font-bold text-white lg:text-2xl">{homepageScenarios[0].title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-brand-100/70">{homepageScenarios[0].body}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-200 transition group-hover:gap-3">
                  {homepageScenarios[0].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>
            {/* Airport — sm: half row, lg: 1/3 */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[1].filters)}
              className="group flex min-h-[160px] flex-col justify-between rounded-3xl bg-[#F3F3F1] px-5 py-5 text-left transition hover:bg-[#ECEAE8] lg:min-h-[180px] lg:px-6 lg:py-6"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{homepageScenarios[1].title}</p>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 lg:text-xl">{homepageScenarios[1].title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500 lg:text-[13px]">{homepageScenarios[1].body}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 transition group-hover:gap-3">
                  {homepageScenarios[1].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>
            {/* Event — sm: half row, lg: 1/3 */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[2].filters)}
              className="group flex min-h-[160px] flex-col justify-between rounded-3xl bg-[#F3F3F1] px-5 py-5 text-left transition hover:bg-[#ECEAE8] lg:min-h-[180px] lg:px-6 lg:py-6"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{homepageScenarios[2].title}</p>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 lg:text-xl">{homepageScenarios[2].title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500 lg:text-[13px]">{homepageScenarios[2].body}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 transition group-hover:gap-3">
                  {homepageScenarios[2].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>
            {/* EV — full width sm, 2/3 lg */}
            <button
              type="button"
              onClick={() => launchScenario(homepageScenarios[3].filters)}
              className="group col-span-2 flex min-h-[160px] flex-col justify-between rounded-3xl bg-slate-900 px-6 py-6 text-left transition hover:bg-slate-800 lg:min-h-[180px] lg:px-8 lg:py-7"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{homepageScenarios[3].title}</p>
              <div>
                <h3 className="font-display text-xl font-bold text-white lg:text-2xl">{homepageScenarios[3].title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{homepageScenarios[3].body}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-slate-300 transition group-hover:gap-3">
                  {homepageScenarios[3].cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </div>
            </button>
          </div>
        </section>

        {/* ── How it works — editorial numbered ── */}
        <section className="mt-16 hidden sm:block pb-16">
          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">How it works</p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Search, book, park
            </h2>
          </div>
          <div>
            {howItWorks.map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-8 border-b border-slate-100 py-8 last:border-0"
              >
                <span className="w-16 shrink-0 select-none font-display text-[72px] font-extrabold leading-none text-slate-100">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="pt-3">
                  <h3 className="font-display text-xl font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-slate-500">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
