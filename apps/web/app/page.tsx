"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import type { SearchFilters } from "../components/SearchForm";
import { SlimNav } from "../components/SlimNav";
import { MobileSearchLanding } from "../components/MobileSearchLanding";

const defaultFilters: SearchFilters = {
  location: "Dublin City Centre",
  date: new Date().toISOString().split("T")[0],
  startTime: "09:00",
  endTime: "18:00",
  radiusKm: 5,
  latitude: 53.3498,
  longitude: -6.2603,
  mode: "daily",
};


export default function HomePage() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<"daily" | "monthly">("daily");
  const [location, setLocation] = useState(defaultFilters.location);
  const [latitude, setLatitude] = useState<number | undefined>(defaultFilters.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(defaultFilters.longitude);
  const [date, setDate] = useState(() => now.toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [heroStyle] = useState<"flat" | "iso" | "line">("line");

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
      startTime,
      endTime,
      mode,
    });
  };

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.12),transparent_40%),#ffffff]">
      <SlimNav />

      <main className="mx-auto w-full max-w-6xl px-6 py-6 sm:py-10">
        <section className="block sm:hidden">
          <MobileSearchLanding
            initialFilters={defaultFilters}
            onSearch={(filters) => handleSearch(filters)}
            hideHeader
          />
        </section>

        <section className="hidden items-center gap-10 sm:grid lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-5">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.32em] text-emerald-600 sm:block">Find parking fast</p>
            <h1 className="hidden font-display text-4xl font-semibold tracking-tight text-slate-900 sm:block sm:text-5xl">
              The smarter way to find<br />parking in seconds.
            </h1>
            <p className="hidden text-base text-slate-600 sm:block">
              Search thousands of trusted spaces, compare prices, and book instantly.
            </p>

            <div className="rounded-[26px] bg-white/60 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6 lg:p-6 min-h-[60dvh] sm:min-h-0 flex flex-col">
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
                  inputClassName="w-full rounded-full border border-slate-200 bg-white px-10 py-3 text-sm font-semibold text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none"
                  onPlace={(place) => {
                    setLocation(place.address);
                    setLatitude(place.lat);
                    setLongitude(place.lng);
                  }}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                    <span className="text-[11px] text-slate-500">From</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
                      />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
                      />
                    </div>
                  </label>
                  <label className="flex flex-col gap-1 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                    <span className="text-[11px] text-slate-500">Until</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
                      />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
                      />
                    </div>
                  </label>
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

            <div className="mt-8 flex justify-center">
              <img
                src="/hero-art.png"
                alt="Person using phone with car"
                className="h-44 w-auto object-contain sm:h-52"
              />
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span>Best price guarantee</span>
              <span>Trusted by thousands</span>
              <span>Flexible cancellation</span>
            </div>
          </div>

          <div className="relative hidden h-[520px] overflow-hidden lg:block">
            <img
              src="/hero-art.png"
              alt="Person using phone with car"
              className="h-full w-full object-contain"
            />
          </div>
        </section>

        <section className="mt-12 grid gap-6 rounded-[26px] bg-white/70 px-6 py-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:grid-cols-3">
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
      </main>
    </div>
  );
}
