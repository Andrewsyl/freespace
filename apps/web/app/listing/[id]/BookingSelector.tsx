"use client";

import Link from "next/link";
import { trackEvent } from "../../../lib/telemetry";
import { useEffect, useRef, useMemo, useState } from "react";
import { calculateListingTotal, formatPriceValue } from "../../../lib/pricing";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundUpToHalfHour(d: Date): Date {
  const out = new Date(d);
  const m = out.getMinutes();
  if (m === 0) return out;
  out.setMinutes(Math.ceil(m / 5) * 5, 0, 0);
  return out;
}

function toTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function defaultStartTime(): string {
  return toTimeString(roundUpToHalfHour(new Date()));
}

function defaultEndTime(fromStartTime?: string): string {
  if (fromStartTime) {
    const [h, m] = fromStartTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return toTimeString(new Date(d.getTime() + 2 * 60 * 60 * 1000));
  }
  const start = roundUpToHalfHour(new Date());
  return toTimeString(new Date(start.getTime() + 2 * 60 * 60 * 1000));
}

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return toTimeString(new Date(d.getTime() + hours * 60 * 60 * 1000));
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Mon-first week
const DAY_LABELS = ["M","T","W","T","F","S","S"];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2,"0")}:${m}`;
});

type DurationPreset = {
  label: string;
  durationHours: number;
};

type FixedPreset = {
  label: string;
  fixedStart: string;
  fixedEnd: string;
};

const PRESETS: Array<DurationPreset | FixedPreset> = [
  { label: "2 hrs",    durationHours: 2 },
  { label: "4 hrs",    durationHours: 4 },
  { label: "Full day", fixedStart: "08:00", fixedEnd: "20:00" },
  { label: "Evening",  fixedStart: "17:00", fixedEnd: "22:00" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateToIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getDaysInMonth(year: number, month: number) {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate()+1); }
  return days;
}

// Mon=0 … Sun=6
function firstDayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatTrigger(iso: string, time: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return `${iso} · ${time}`;
  const label = d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
  return `${label} · ${time}`;
}

function buildBookingWindow(startDate: string, startTime: string, endDate: string, endTime: string) {
  const start = new Date(`${startDate}T${startTime}:00`);
  const rawEnd = new Date(`${endDate}T${endTime}:00`);
  const end =
    rawEnd.getTime() <= start.getTime()
      ? new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000)
      : rawEnd;
  return { start, end };
}

// ─── Single calendar dropdown ─────────────────────────────────────────────────

function CalendarDropdown({
  label,
  date,
  time,
  bookedDates,
  onConfirm,
  onClose,
}: {
  label: string;
  date: string;
  time: string;
  bookedDates: string[];
  onConfirm: (date: string, time: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const todayIso = dateToIso(today);

  const [viewYear, setViewYear]   = useState(() => new Date(date).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date(date).getMonth());
  const [selDate, setSelDate]     = useState(date);
  const [selTime, setSelTime]     = useState(time);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const days   = getDaysInMonth(viewYear, viewMonth);
  const offset = firstDayOffset(viewYear, viewMonth);
  const canGoPrev = viewYear > today.getFullYear() || viewMonth > today.getMonth();

  function prevMonth() {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear(y=>y-1); setViewMonth(11); }
    else setViewMonth(m=>m-1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y=>y+1); setViewMonth(0); }
    else setViewMonth(m=>m+1);
  }

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.18)]"
    >
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:opacity-20"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</p>
          <p className="text-[15px] font-bold text-slate-950">{MONTH_NAMES[viewMonth]} {viewYear}</p>
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-t border-slate-100 px-3 pt-2">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="text-center text-[11px] font-bold uppercase tracking-wide text-slate-600 pb-1">
            {l}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 px-3 pb-2">
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
        {days.map((day) => {
          const iso      = dateToIso(day);
          const isPast   = iso < todayIso;
          const isSun    = day.getDay() === 0;
          const isBooked = bookedDates.includes(iso);
          const disabled = isPast || isSun || isBooked;
          const isSel    = iso === selDate;
          const isToday  = iso === todayIso;

          return (
            <div key={iso} className="flex items-center justify-center py-[3px]">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setSelDate(iso)}
                className={[
                  "relative flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold transition",
                  isSel
                    ? "bg-brand-500 text-white"
                    : isToday && !disabled
                    ? "bg-brand-500/15 text-brand-700 ring-1 ring-brand-500"
                    : !disabled
                    ? "bg-brand-500/10 text-slate-800 hover:bg-brand-500/25"
                    : isPast
                    ? "text-slate-300 line-through decoration-slate-300"
                    : "cursor-not-allowed text-slate-300",
                ].join(" ")}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Dark footer — time + Done */}
      <div className="bg-slate-950 px-4 py-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[13px] font-semibold text-white">{label}:</span>
          <div className="relative flex-1">
            <select
              value={selTime}
              onChange={(e) => setSelTime(e.target.value)}
              className="w-full appearance-none rounded-lg border border-white/20 bg-white/10 py-2 pl-3 pr-8 text-[13px] font-semibold text-white focus:outline-none"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t} className="text-slate-900 bg-white">{t}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { onConfirm(selDate, selTime); onClose(); }}
          className="w-full rounded-lg bg-brand-500 py-3 text-[14px] font-bold text-white transition hover:bg-brand-600"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Trigger field ────────────────────────────────────────────────────────────

function TriggerField({
  label,
  date,
  time,
  open,
  onToggle,
}: {
  label: string;
  date: string;
  time: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
        open
          ? "border-brand-500 ring-1 ring-brand-500/30"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Calendar icon */}
      <svg className="shrink-0 text-brand-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">{label}</p>
        <p className="truncate text-[13px] font-semibold text-slate-900">{formatTrigger(date, time)}</p>
      </div>
      <svg className={`shrink-0 text-brand-500 transition-transform ${open ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BookingSelector({
  listingId,
  bookedDates = [],
  pricePerDay,
  pricePerHour,
  rateType,
  dark = false,
  hidePrice = false,
  onPricingChange,
  initialValues,
}: {
  listingId: string;
  bookedDates?: string[];
  pricePerDay?: number;
  pricePerHour?: number | null;
  rateType?: "hourly" | "daily" | null;
  dark?: boolean;
  hidePrice?: boolean;
  onPricingChange?: (pricing: {
    subtotal: number;
    total: number;
    durationLabel: string;
    billingLabel: string;
  }) => void;
  initialValues?: {
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
  };
}) {
  const todayIso = dateToIso(new Date());

  const defaultDate = useMemo(() => {
    if (initialValues?.startDate) {
      return initialValues.startDate;
    }
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const iso = dateToIso(d);
      if (iso >= todayIso && d.getDay() !== 0 && !bookedDates.includes(iso)) return iso;
      d.setDate(d.getDate()+1);
    }
    return todayIso;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [startDate, setStartDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? defaultStartTime());
  const [endDate,   setEndDate]   = useState(initialValues?.endDate ?? initialValues?.startDate ?? defaultDate);
  const [endTime,   setEndTime]   = useState(initialValues?.endTime ?? defaultEndTime(initialValues?.startTime));
  const [openPicker, setOpenPicker] = useState<"start"|"end"|null>(null);

  const href = `/checkout/${listingId}?date=${startDate}&startTime=${startTime}&endDate=${endDate}&endTime=${endTime}`;
  const bookingWindow = useMemo(
    () => buildBookingWindow(startDate, startTime, endDate, endTime),
    [startDate, startTime, endDate, endTime]
  );
  const pricing = useMemo(() => {
    const summary = calculateListingTotal(
      {
        pricePerDay: pricePerDay ?? 0,
        pricePerHour: pricePerHour ?? null,
        rateType: rateType ?? "daily",
      },
      bookingWindow.start,
      bookingWindow.end
    );
    return {
      subtotal: summary.total,
      total: summary.total + 1.5,
      durationLabel: summary.durationLabel,
      billingLabel: `€${formatPriceValue(summary.total)} for ${summary.durationLabel}`,
    };
  }, [bookingWindow.end, bookingWindow.start, pricePerDay, pricePerHour, rateType]);

  useEffect(() => {
    onPricingChange?.(pricing);
  }, [onPricingChange, pricing]);

  return (
    <div className="space-y-3">

      {/* Price */}
      {!hidePrice && (
        <div className={`text-[32px] font-semibold leading-none tracking-[-0.05em] ${dark ? "text-white" : "text-slate-950"}`}>
          €{formatPriceValue(pricing.subtotal)}
          <span className={`ml-1.5 text-[15px] ${dark ? "text-white/70" : "text-slate-600"}`}>
            for {pricing.durationLabel}
          </span>
        </div>
      )}

      {/* Parking from */}
      <div className="relative">
        <TriggerField
          label="Parking from"
          date={startDate}
          time={startTime}
          open={openPicker === "start"}
          onToggle={() => setOpenPicker(o => o === "start" ? null : "start")}
        />
        {openPicker === "start" && (
          <CalendarDropdown
            label="Enter after"
            date={startDate}
            time={startTime}
            bookedDates={bookedDates}
            onConfirm={(d, t) => { setStartDate(d); setStartTime(t); if (d > endDate) setEndDate(d); }}
            onClose={() => setOpenPicker(null)}
          />
        )}
      </div>

      {/* Parking until */}
      <div className="relative">
        <TriggerField
          label="Parking until"
          date={endDate}
          time={endTime}
          open={openPicker === "end"}
          onToggle={() => setOpenPicker(o => o === "end" ? null : "end")}
        />
        {openPicker === "end" && (
          <CalendarDropdown
            label="Exit before"
            date={endDate}
            time={endTime}
            bookedDates={bookedDates}
            onConfirm={(d, t) => { setEndDate(d); setEndTime(t); }}
            onClose={() => setOpenPicker(null)}
          />
        )}
      </div>

      {/* Quick-select chips */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {PRESETS.map((p) => {
          const isFixedPreset = "fixedStart" in p;
          if (isFixedPreset) {
            const active = startTime === p.fixedStart && endTime === p.fixedEnd;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setStartTime(p.fixedStart);
                  setEndTime(p.fixedEnd);
                }}
                className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                  active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600"
                }`}
              >
                {p.label}
              </button>
            );
          }

          const expectedEnd = addHoursToTime(startTime, p.durationHours);
          const active = endTime === expectedEnd;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setEndTime(addHoursToTime(startTime, p.durationHours));
              }}
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                active
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Reserve button */}
      <Link
        href={href as any}
        onClick={() =>
          void trackEvent("web_booking_started", {
            listingId,
            startDate,
            startTime,
            endDate,
            endTime,
          })
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3.5 text-[15px] font-bold text-white transition hover:bg-brand-600"
      >
        Reserve · €{formatPriceValue(pricing.subtotal)}{pricing.durationLabel ? ` · ${pricing.durationLabel}` : ""}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </Link>

    </div>
  );
}
