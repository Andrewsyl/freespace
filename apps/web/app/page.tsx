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

      <main className="mx-auto w-full max-w-6xl px-6 py-6 sm:py-10">
        <section className="block sm:hidden -mx-6 -mt-6 pt-4">
          <MobileSearchLanding
            initialFilters={defaultFilters}
            onSearch={(filters) => handleSearch(filters)}
            hideHeader
          />
        </section>

        <section className="hidden items-center gap-10 sm:grid lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-5">
            <h1 className="hidden font-display text-4xl font-semibold tracking-tight text-slate-900 sm:block sm:text-5xl">
              The smarter way to find<br />parking in seconds.
            </h1>
            <p className="hidden text-base text-slate-600 sm:block">
              Search thousands of trusted spaces, compare prices, and book instantly.
            </p>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
              <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-100 p-1 text-sm font-semibold shadow-sm">
                {(["daily", "monthly"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`font-display flex-1 rounded-full py-2.5 transition ${
                      mode === value
                        ? "bg-emerald-600 text-white shadow-[0_8px_18px_rgba(16,185,129,0.35)]"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {value === "daily" ? "Hourly / Daily" : "Monthly"}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3 flex-1">
                <AddressAutocomplete
                  defaultValue={location}
                  placeholder="Where would you like to park?"
                  inputClassName="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none"
                  onPlace={(place) => {
                    setLocation(place.address);
                    setLatitude(place.lat);
                    setLongitude(place.lng);
                  }}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
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
                    <label className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                      <span className="text-[11px] text-slate-500">Plan</span>
                      <div className="relative">
                        <select
                          value={monthlyPlan}
                          onChange={(event) => setMonthlyPlan(event.target.value as NonNullable<SearchFilters["monthlyPlan"]>)}
                          className="w-full appearance-none rounded-lg bg-transparent px-1 py-1 text-sm font-semibold text-slate-800 outline-none"
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
                    <label className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
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
                  className="font-display w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                >
                  Show parking spaces
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span>Best price guarantee</span>
              <span>Trusted by thousands</span>
              <span>Flexible cancellation</span>
            </div>
          </div>

          <div className="relative hidden h-[520px] overflow-hidden lg:block">
            <Image
              src="/hero-art.png"
              alt="Person using phone with car"
              fill
              priority
              sizes="(min-width: 1024px) 520px, 0px"
              className="object-contain"
            />
          </div>
        </section>

        <section className="mt-10 grid gap-6 rounded-2xl border border-slate-200 bg-white px-6 py-8 sm:grid-cols-3">
          {[
            { title: "Stress-free booking", body: "Reserve a space in seconds and skip the parking scramble." },
            { title: "No surprises", body: "See the total cost before you book. No hidden fees." },
            { title: "Quick arrival", body: "Clear instructions and easy access when you arrive." },
          ].map((item) => (
            <div key={item.title} className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-slate-900">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 space-y-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Ways to park</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Parking for every kind of trip
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {homepageScenarios.map((scenario) => (
              <button
                key={scenario.title}
                type="button"
                onClick={() => launchScenario(scenario.filters)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    {scenario.title}
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-lg font-semibold text-slate-900">{scenario.title}</h3>
                    <p className="text-sm leading-6 text-slate-600">{scenario.body}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {scenario.cta}
                    <span aria-hidden>→</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-8">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">How it works</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Search, book, park
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {howItWorks.map((step, index) => (
              <div key={step.title} className="rounded-[22px] bg-slate-50 px-5 py-5">
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
