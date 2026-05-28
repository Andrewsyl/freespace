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
        {/* ── Hero ── */}
        <section className="grid lg:grid-cols-[1fr_460px] gap-8 lg:gap-14 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500 mb-5">Dublin · Ireland</p>
            <h1 className="font-display tracking-tight">
              <span className="block text-[30px] font-medium leading-[1.06] text-slate-800 sm:text-[40px] lg:text-[58px]">The smarter way to</span>
              <span className="block text-[30px] font-extrabold leading-[1.06] text-brand-500 sm:text-[40px] lg:text-[58px]">find parking.</span>
            </h1>
            <p className="mt-5 max-w-[380px] text-[15px] leading-relaxed text-slate-500">
              Search thousands of trusted spaces across Dublin. Compare prices and book instantly — no stress, no surprises.
            </p>

            {/* Search card — shadow depth, no heavy border */}
            <div className="mt-8 rounded-3xl bg-white shadow-[0_4px_32px_rgba(0,0,0,0.09)] ring-1 ring-slate-900/[0.06]">
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

                <div className="grid grid-cols-2 gap-3">
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
        <div className="mt-8 grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-5 sm:mt-12 sm:py-7">
          {[
            { stat: "5,000+", label: "Spaces in Dublin", accent: true },
            { stat: "Instant", label: "Confirmation" },
            { stat: "Best price", label: "Guarantee" },
          ].map((item) => (
            <div key={item.stat} className="px-3 first:pl-0 last:pr-0 sm:px-6 lg:px-10">
              <p className={`font-display text-base font-extrabold sm:text-xl lg:text-2xl ${(item as any).accent ? "text-brand-500" : "text-slate-900"}`}>{item.stat}</p>
              <p className="mt-0.5 text-[10px] text-slate-400 sm:text-sm">{item.label}</p>
            </div>
          ))}
        </div>

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
              <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-amber-800/40">{homepageScenarios[1].title}</p>
              <div className="relative">
                <h3 className="font-display text-lg font-bold text-slate-900 lg:text-xl">{homepageScenarios[1].title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500 lg:text-[13px]">{homepageScenarios[1].body}</p>
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
              <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-400/60">{homepageScenarios[2].title}</p>
              <div className="relative">
                <h3 className="font-display text-lg font-bold text-slate-900 lg:text-xl">{homepageScenarios[2].title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500 lg:text-[13px]">{homepageScenarios[2].body}</p>
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
                className="flex items-start gap-8 border-b border-slate-100 py-8 last:border-0"
              >
                <span className="w-12 shrink-0 select-none font-display text-[56px] font-extrabold leading-none text-slate-300 sm:w-16 sm:text-[72px]">
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
      <SiteFooter />
    </div>
  );
}
