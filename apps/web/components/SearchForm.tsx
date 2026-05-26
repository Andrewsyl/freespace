"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { format } from "date-fns";

export type SearchFilters = {
  location: string;
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  radiusKm: number;
  latitude?: number;
  longitude?: number;
  mode?: "daily" | "monthly";
  priceMin?: number;
  priceMax?: number;
  coveredParking?: boolean;
  evCharging?: boolean;
  securityLevel?: "basic" | "gated" | "cctv";
  vehicleSize?: "motorcycle" | "car" | "van";
  spaceType?: string;
  instantBook?: boolean;
};

type DateTimePickerProps = {
  label: "From" | "Until";
  inlineLabel?: string;
  value: Date;
  onChange: (next: Date) => void;
  compact?: boolean;
  inline?: boolean;
  popupAlign?: "left" | "right";
};

export function SearchForm({
  initialValues,
  onSearch,
  redirectToSearch = false,
  onOpenFilters,
  autoSearch = true,
  onAddressChange,
  variant = "default",
}: {
  initialValues?: Partial<SearchFilters>;
  onSearch?: (filters: SearchFilters) => void;
  redirectToSearch?: boolean;
  onOpenFilters?: () => void;
  autoSearch?: boolean;
  onAddressChange?: (place: { address: string; lat: number; lng: number }) => void;
  variant?: "default" | "desktop-inline";
}) {
  const router = useRouter();
  const skipAutoSearch = useRef(true);
  const syncingFromProps = useRef(false);

  const initialStart = useMemo(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
    return now;
  }, []);

  const [state, setState] = useState(() => {
    const startFromProps = initialValues?.date
      ? buildDateTime(initialValues.date, initialValues.startTime ?? toTimeString(initialStart))
      : initialStart;
    const endFromProps =
      initialValues?.endDate && initialValues?.endTime
        ? buildDateTime(initialValues.endDate, initialValues.endTime)
        : addMinutes(startFromProps, 180);
    return {
      location: initialValues?.location ?? "Dublin City Centre",
      latitude: initialValues?.latitude ?? 53.3498,
      longitude: initialValues?.longitude ?? -6.2603,
      mode: initialValues?.mode ?? "daily",
      startAt: startFromProps,
      endAt: endFromProps,
      radiusKm: initialValues?.radiusKm ?? 5,
      priceMin: initialValues?.priceMin,
      priceMax: initialValues?.priceMax,
      coveredParking: initialValues?.coveredParking,
      evCharging: initialValues?.evCharging,
      securityLevel: initialValues?.securityLevel,
      vehicleSize: initialValues?.vehicleSize,
      spaceType: initialValues?.spaceType,
      instantBook: initialValues?.instantBook,
    };
  });

  useEffect(() => {
    if (!initialValues) return;
    setState((prev) => {
      const startFromProps = initialValues.date
        ? buildDateTime(initialValues.date, initialValues.startTime ?? toTimeString(initialStart))
        : prev.startAt;
      const endFromProps =
        initialValues.endDate && initialValues.endTime
          ? buildDateTime(initialValues.endDate, initialValues.endTime)
          : addMinutes(startFromProps, 120);
      const nextState = {
        ...prev,
        ...initialValues,
        startAt: startFromProps,
        endAt: endFromProps,
      };
      const unchanged =
        prev.location === nextState.location &&
        prev.latitude === nextState.latitude &&
        prev.longitude === nextState.longitude &&
        prev.mode === nextState.mode &&
        prev.radiusKm === nextState.radiusKm &&
        prev.priceMin === nextState.priceMin &&
        prev.priceMax === nextState.priceMax &&
        prev.coveredParking === nextState.coveredParking &&
        prev.evCharging === nextState.evCharging &&
        prev.securityLevel === nextState.securityLevel &&
        prev.vehicleSize === nextState.vehicleSize &&
        prev.spaceType === nextState.spaceType &&
        prev.instantBook === nextState.instantBook &&
        prev.startAt.getTime() === nextState.startAt.getTime() &&
        prev.endAt.getTime() === nextState.endAt.getTime();
      if (unchanged) return prev;
      syncingFromProps.current = true;
      return nextState;
    });
  }, [initialValues, initialStart]);

  const buildFilters = useCallback((current = state): SearchFilters => {
    const startDate = toDateString(current.startAt);
    const endDate = toDateString(current.endAt);
    const startTime = toTimeString(current.startAt);
    const endTime = toTimeString(current.endAt);
    const submission: SearchFilters = {
      location: current.location,
      date: startDate,
      endDate,
      startTime,
      endTime,
      radiusKm: current.radiusKm,
      latitude: current.latitude,
      longitude: current.longitude,
      mode: current.mode,
      priceMin: current.priceMin,
      priceMax: current.priceMax,
      coveredParking: current.coveredParking,
      evCharging: current.evCharging,
      securityLevel: current.securityLevel,
      vehicleSize: current.vehicleSize,
      spaceType: current.spaceType,
      instantBook: current.instantBook,
    };
    if (current.mode === "monthly") {
      const end = new Date(current.startAt);
      end.setMonth(end.getMonth() + 1);
      submission.startTime = "00:00";
      submission.endTime = "23:59";
      submission.endDate = toDateString(end);
    }
    return submission;
  }, [state]);

  useEffect(() => {
    if (!onSearch || redirectToSearch || !autoSearch) return;
    if (skipAutoSearch.current) {
      skipAutoSearch.current = false;
      return;
    }
    if (syncingFromProps.current) {
      syncingFromProps.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onSearch(buildFilters());
    }, 250);
    return () => clearTimeout(timer);
  }, [state, onSearch, redirectToSearch, autoSearch, buildFilters]);

  const geocodeAddress = async (address: string) => {
    if (!(window as any).google?.maps?.Geocoder) return null;
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ address }, (results: any[], status: string) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          resolve(null);
        }
      });
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submission = buildFilters();

    if (redirectToSearch && (!submission.latitude || !submission.longitude)) {
      const geo = await geocodeAddress(submission.location);
      if (geo) {
        submission.latitude = geo.lat;
        submission.longitude = geo.lng;
      }
    }

    if (onSearch) {
      onSearch(submission);
      return;
    }
    if (redirectToSearch) {
      const params = new URLSearchParams({
        location: submission.location,
        date: submission.date,
        startTime: submission.startTime,
        endTime: submission.endTime,
        radiusKm: String(submission.radiusKm),
        mode: submission.mode ?? "daily",
      });
      if (submission.endDate) params.set("endDate", submission.endDate);
      if (submission.latitude !== undefined) params.set("lat", String(submission.latitude));
      if (submission.longitude !== undefined) params.set("lng", String(submission.longitude));
      if (submission.priceMin !== undefined) params.set("priceMin", String(submission.priceMin));
      if (submission.priceMax !== undefined) params.set("priceMax", String(submission.priceMax));
      if (submission.coveredParking) params.set("coveredParking", "true");
      if (submission.evCharging) params.set("evCharging", "true");
      if (submission.securityLevel) params.set("securityLevel", submission.securityLevel);
      if (submission.vehicleSize) params.set("vehicleSize", submission.vehicleSize);
      if (submission.spaceType) params.set("spaceType", submission.spaceType);
      if (submission.instantBook) params.set("instantBook", "true");
      router.push(`/search?${params.toString()}`);
      return;
    }
  };

  const setStart = (next: Date) => {
    const adjustedEnd = state.endAt <= next ? addMinutes(next, 180) : state.endAt;
    setState((prev) => ({ ...prev, startAt: next, endAt: adjustedEnd }));
  };

  const setEnd = (next: Date) => {
    if (next <= state.startAt) {
      setState((prev) => ({ ...prev, endAt: addMinutes(prev.startAt, 180) }));
      return;
    }
    setState((prev) => ({ ...prev, endAt: next }));
  };

  const addressOnPlace = useCallback((place: { address: string; lat: number; lng: number }) => {
    setState((prev) => ({
      ...prev,
      location: place.address,
      latitude: place.lat,
      longitude: place.lng,
    }));
    onAddressChange?.({ address: place.address, lat: place.lat, lng: place.lng });
  }, [onAddressChange]);

  // ── Desktop-inline variant ────────────────────────────────────────────────
  if (variant === "desktop-inline") {
    return (
      <div className="w-full">
        <form onSubmit={handleSubmit}>
          <div className="flex items-stretch rounded-2xl border border-slate-200 bg-white shadow-md ring-1 ring-black/[0.03]">
            {/* Location segment */}
            <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3.5">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Find parking near</p>
              <AddressAutocomplete
                defaultValue={state.location}
                placeholder="Enter area or landmark"
                inputClassName="w-full bg-transparent pl-0 pr-2 text-[13.5px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
                onPlace={addressOnPlace}
              />
            </div>

            {/* Divider */}
            <div className="my-3 w-px shrink-0 self-stretch bg-slate-200" />

            {/* Arriving picker */}
            <DateTimePicker
              label="From"
              inlineLabel="Arriving"
              value={state.startAt}
              onChange={setStart}
              inline
              popupAlign="left"
            />

            {/* Divider */}
            <div className="my-3 w-px shrink-0 self-stretch bg-slate-200" />

            {/* Leaving picker */}
            <DateTimePicker
              label="Until"
              inlineLabel="Leaving"
              value={state.endAt}
              onChange={setEnd}
              inline
              popupAlign="right"
            />

            {/* Search button */}
            <div className="flex items-center px-3">
              <button
                type="submit"
                aria-label="Search"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm transition hover:bg-brand-600 active:scale-95"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ── Default variant ───────────────────────────────────────────────────────
  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm"
      >
        <AddressAutocomplete
          defaultValue={state.location}
          placeholder="Enter area or landmark"
          inputClassName="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white px-9 text-[15px] font-semibold text-[#0f172a] transition focus:border-brand-500 focus:outline-none"
          onPlace={addressOnPlace}
        />

        <div className="grid grid-cols-2 gap-2">
          <DateTimePicker label="From" value={state.startAt} onChange={setStart} compact />
          <DateTimePicker label="Until" value={state.endAt} onChange={setEnd} compact />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {onOpenFilters && (
            <button
              type="button"
              onClick={onOpenFilters}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m12-3V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 9.75V10.5" />
              </svg>
              Filters
            </button>
          )}
          <button
            type="submit"
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-[15px] font-bold text-white shadow-md transition hover:bg-brand-600 active:scale-[0.98] ${
              onOpenFilters ? "" : "col-span-2"
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Search
          </button>
        </div>
      </form>
    </div>
  );
}

// ── DateTimePicker ────────────────────────────────────────────────────────────

function DateTimePicker({
  label,
  inlineLabel,
  value,
  onChange,
  compact = false,
  inline = false,
  popupAlign = "left",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(startOfMonth(value));
  const containerRef = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextMonth = startOfMonth(value);
    setViewMonth((current) =>
      current.getFullYear() === nextMonth.getFullYear() &&
      current.getMonth() === nextMonth.getMonth()
        ? current
        : nextMonth
    );
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-scroll time list to the selected item whenever the popup opens
  useEffect(() => {
    if (!open || !timeListRef.current) return;
    const selectedEl = timeListRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (selectedEl) {
      timeListRef.current.scrollTop = Math.max(0, selectedEl.offsetTop - 56);
    }
  }, [open]);

  const times = useMemo(() => {
    const slots: string[] = [];
    for (let i = 0; i < 24 * 60; i += 5) {
      const hh = String(Math.floor(i / 60)).padStart(2, "0");
      const mm = String(i % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }, []);

  const days = buildMonthGrid(viewMonth);

  const handleDateSelect = (day: Date) => {
    const next = new Date(day);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(next);
  };

  const handleTimeSelect = (time: string) => {
    onChange(buildDateTime(toDateString(value), time));
  };

  const currentTime = toTimeString(value);
  const timeLabel = label === "From" ? "Enter after" : "Leave by";
  const alignClass = popupAlign === "right" ? "right-0" : "left-0";

  // ── Shared popup ────────────────────────────────────────────────────────
  const popup = open ? (
    <div
      className={`absolute ${alignClass} z-50 mt-2 w-[400px] max-w-[95vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.16)] ring-1 ring-slate-100/80`}
    >
      {/* Popup header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label} time</p>
          <p className="mt-0.5 text-[13px] font-bold text-slate-900">{formatTrigger(value)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(viewMonth, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="w-28 text-center text-[12px] font-semibold text-slate-800">
            {formatMonthTitle(viewMonth)}
          </span>
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Day-name headers */}
        <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (!day) return <div key={idx} className="h-9 rounded-xl" />;
            const isSelected = isSameDay(day, value);
            const isToday = isSameDay(day, new Date());
            const inMonth = day.getMonth() === viewMonth.getMonth();
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleDateSelect(day)}
                className={`h-9 rounded-xl text-[13px] transition ${
                  isSelected
                    ? "bg-brand-500 font-bold text-white shadow-sm"
                    : isToday
                      ? "font-bold text-brand-600 hover:bg-brand-50"
                      : inMonth
                        ? "font-semibold text-slate-700 hover:bg-slate-100"
                        : "font-semibold text-slate-300 hover:bg-slate-50"
                }`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        {/* Time picker — scrollable list replacing <select> */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {timeLabel}
          </p>
          <div
            ref={timeListRef}
            className="max-h-[168px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 scroll-smooth"
          >
            {times.map((t) => {
              const isSel = t === currentTime;
              return (
                <button
                  key={t}
                  type="button"
                  data-selected={isSel ? "true" : undefined}
                  onClick={() => handleTimeSelect(t)}
                  className={`flex w-full items-center justify-between px-3.5 py-[7px] text-left text-[13px] font-semibold transition ${
                    isSel
                      ? "bg-brand-500 text-white"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  {t}
                  {isSel && (
                    <svg
                      className="h-3.5 w-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Done */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl bg-brand-500 px-5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Inline trigger (used inside the desktop search bar) ──────────────────
  if (inline) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className={`flex w-[210px] flex-col justify-center px-5 py-3.5 text-left transition hover:bg-slate-50/80 ${
            open ? "bg-slate-50/80" : ""
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {inlineLabel ?? label}
          </p>
          <p className="mt-0.5 tabular-nums text-[13.5px] font-semibold text-slate-900">
            {formatTrigger(value)}
          </p>
        </button>
        {popup}
      </div>
    );
  }

  // ── Standalone trigger (default / mobile form) ────────────────────────────
  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-xl border bg-white text-left shadow-sm transition ${
          open
            ? "border-brand-400 ring-2 ring-brand-100"
            : "border-[#E5E7EB] hover:border-slate-300"
        } ${compact ? "h-12 px-3 py-2" : "px-3.5 py-2.5"}`}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-brand-600">{label}</span>
          <span className="tabular-nums text-[13px] font-bold text-slate-900">{formatTrigger(value)}</span>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180 text-brand-500" : "text-slate-400"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {popup}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDateTime(date: string, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function formatTrigger(date: Date) {
  return format(date, "EEE d MMM, HH:mm");
}

function toDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function toTimeString(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return startOfMonth(d);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthGrid(month: Date) {
  const start = startOfMonth(month);
  const startDay = start.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
