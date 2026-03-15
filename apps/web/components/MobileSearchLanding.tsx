"use client";

import { useMemo, useState } from "react";
import { AddressAutocomplete } from "./AddressAutocomplete";
import type { SearchFilters } from "./SearchForm";

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const TIME_SLOTS = Array.from({ length: 24 * 2 }, (_, i) =>
  `${pad2(Math.floor(i / 2))}:${i % 2 === 0 ? "00" : "30"}`,
);

function pad2(n: number) { return String(n).padStart(2, "0"); }

function formatDatetime(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  let label: string;
  if (day.getTime() === today.getTime()) label = "Today";
  else if (day.getTime() === tomorrow.getTime()) label = "Tomorrow";
  else label = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()].slice(0, 3)}`;
  return `${label}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60000);
}

function snapTo5(d: Date): Date {
  const out = new Date(d);
  out.setMinutes(Math.ceil(out.getMinutes() / 5) * 5, 0, 0);
  return out;
}

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
  const defaultStart = useMemo(() => snapTo5(new Date()), []);
  const defaultEnd = useMemo(() => addMinutes(defaultStart, 120), [defaultStart]);

  const [mode, setMode] = useState<"daily" | "monthly">(initialFilters.mode ?? "daily");
  const [location, setLocation] = useState(initialFilters.location ?? "");
  const [latitude, setLatitude] = useState(initialFilters.latitude);
  const [longitude, setLongitude] = useState(initialFilters.longitude);
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(defaultEnd);

  // Date/time picker sheet state
  const [pickerOpen, setPickerOpen] = useState<"start" | "end" | null>(null);

  const handleSubmit = () => {
    if (!location) return;
    const toDate = (d: Date) => d.toISOString().split("T")[0];
    const toTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    onSearch({
      ...initialFilters,
      location,
      latitude: latitude ?? initialFilters.latitude,
      longitude: longitude ?? initialFilters.longitude,
      mode,
      date: toDate(startAt),
      startTime: toTime(startAt),
      endDate: toDate(endAt),
      endTime: toTime(endAt),
      radiusKm: 5,
    });
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-white px-5"
      style={{ paddingTop: hideHeader ? "0px" : "env(safe-area-inset-top)" }}
    >
      {/* ── Header ── */}
      {!hideHeader && (
        <div className="flex items-center justify-center py-4">
          <img src="/freespace-logo.png" alt="FreeSpace" className="h-12 w-auto mix-blend-multiply" />
        </div>
      )}

      {/* ── Mode toggle ── */}
      <div className="mb-4 flex rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-1 text-sm font-semibold">
        {(["daily", "monthly"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-2 transition-all duration-150 ${
              mode === m ? "bg-[#E8F5E9] text-[#166534]" : "text-[#9CA3AF]"
            }`}
          >
            {m === "daily" ? "Hourly / Daily" : "Monthly"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
        {/* ── Location search ── */}
        <div className="mb-3">
          <AddressAutocomplete
            defaultValue={location}
            placeholder="Enter a place or postcode"
            inputClassName="w-full rounded-xl border border-[#E5E7EB] bg-white px-9 py-3 text-[15px] font-semibold text-[#0f172a] transition focus:border-brand-500 focus:outline-none"
            onPlace={(place) => {
              setLocation(place.address);
              setLatitude(place.lat);
              setLongitude(place.lng);
            }}
          />
        </div>

        {/* ── Date row ── */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen("start")}
            className="flex flex-col rounded-xl border border-[#E5E7EB] px-4 py-3 text-left active:bg-[#F9FAFB]"
          >
            <span className="text-[11px] font-semibold text-[#16A34A]">From</span>
            <span className="mt-0.5 text-[13px] font-bold text-[#0f172a] leading-snug">{formatDatetime(startAt)}</span>
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen("end")}
            className="flex flex-col rounded-xl border border-[#E5E7EB] px-4 py-3 text-left active:bg-[#F9FAFB]"
          >
            <span className="text-[11px] font-semibold text-[#16A34A]">Until</span>
            <span className="mt-0.5 text-[13px] font-bold text-[#0f172a] leading-snug">{formatDatetime(endAt)}</span>
          </button>
        </div>

        {/* ── CTA ── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!location}
          className="w-full rounded-xl bg-brand-500 py-4 text-[15px] font-bold text-white transition active:opacity-90 disabled:opacity-40"
        >
          Show parking spaces
        </button>
      </div>

      <div className="mt-10 flex justify-center pb-10">
        <img
          src="/hero-art.png"
          alt="Person using phone with car"
          className="h-44 w-auto object-contain"
        />
      </div>

      {/* ── Date/time picker bottom sheet ── */}
      {pickerOpen && (
        <DateTimeSheet
          field={pickerOpen}
          startAt={startAt}
          endAt={endAt}
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
    </div>
  );
}

// ── DateTimeSheet — full-screen calendar ──────────────────────────────────────

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

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const minDay = field === "end"
    ? (() => { const d = new Date(startAt); d.setHours(0, 0, 0, 0); return d; })()
    : today;

  // Calendar grid — week starts Monday
  const calDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = (first.getDay() + 6) % 7; // Mon=0
    const cells: (Date | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push(new Date(viewYear, viewMonth, d));
    }
    return cells;
  }, [viewYear, viewMonth]);

  const timeValue = `${pad2(draft.getHours())}:${pad2(draft.getMinutes())}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-[18px] font-semibold text-[#0f172a]">
          {field === "start" ? "Park from" : "Park until"}
        </h2>
        <button type="button" onClick={onClose} className="text-[14px] font-semibold text-brand-600">
          Cancel
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-5 pb-3">
        <span className="text-[14px] font-semibold text-[#1F2937]">
          {MONTHS_LONG[viewMonth]} {viewYear}
        </span>
        <div className="flex items-center gap-3 text-brand-600">
          <button type="button" onClick={prevMonth} className="p-1 text-brand-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={nextMonth} className="p-1 text-brand-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-5 pb-2">
        {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#B0B8C5]">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 content-start gap-y-2 px-5 py-2">
        {calDays.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
          const isBeforeMin = dayStart < minDay;
          const isDisabled = isBeforeMin;
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
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition
                ${isSelected ? "bg-brand-500 font-semibold text-white" :
                  isToday ? "border border-brand-500 text-brand-700 font-semibold" :
                  isDisabled ? "text-[#C7CDD8]" :
                  "font-medium text-[#0f172a] active:bg-[#F1F5F9]"}
              `}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer: label + time select + Done */}
      <div
        className="mt-auto flex items-center gap-3 border-t border-[#EEF2F7] px-5 py-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <span className="text-[13px] text-[#6B7280]">
          {field === "start" ? "Enter after" : "Leave by"}
        </span>
        <div className="relative">
          <select
            value={timeValue}
            onChange={(e) => {
              if (!e.target.value) return;
              const [h, m] = e.target.value.split(":").map(Number);
              const next = new Date(draft);
              next.setHours(h, m, 0, 0);
              setDraft(next);
            }}
            className="appearance-none rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-3 pr-8 text-[14px] font-semibold text-[#0f172a] focus:outline-none"
          >
            {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => onConfirm(draft)}
          className="ml-auto rounded-xl bg-brand-500 px-6 py-2.5 text-[14px] font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Icons — none needed in main form (AddressAutocomplete has its own 📍) ──────
