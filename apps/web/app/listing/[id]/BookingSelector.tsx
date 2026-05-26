"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatListingPriceLine } from "../../../lib/pricing";

type Day = {
  date: string;
  label: string;
  disabled: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function buildDays(bookedDates: string[] = []) {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const days: Day[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().split("T")[0];
    const isSunday = d.getUTCDay() === 0;
    const booked = bookedDates.includes(iso);
    days.push({
      date: iso,
      label: dateFormatter.format(d),
      disabled: isSunday || booked,
    });
  }
  return days;
}

function formatSelectedDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return `${date} at ${time}`;
  return `${fullDateFormatter.format(parsed)} at ${time}`;
}

export function BookingSelector({
  listingId,
  bookedDates = [],
  pricePerDay,
  pricePerHour,
  rateType,
  dark = false,
  hidePrice = false,
}: {
  listingId: string;
  bookedDates?: string[];
  pricePerDay?: number;
  pricePerHour?: number | null;
  rateType?: "hourly" | "daily" | null;
  dark?: boolean;
  hidePrice?: boolean;
}) {
  const days = useMemo(() => buildDays(bookedDates), [bookedDates]);
  const defaultDay = days.find((d) => !d.disabled)?.date ?? days[0]?.date;
  const [selectedDate, setSelectedDate] = useState(defaultDay);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [showEditor, setShowEditor] = useState(false);

  const href = `/checkout/${listingId}?date=${selectedDate}&startTime=${startTime}&endTime=${endTime}`;
  const selectedDayLabel = days.find((day) => day.date === selectedDate)?.label ?? selectedDate;
  const startSummary = formatSelectedDateTime(selectedDate, startTime);
  const endSummary = formatSelectedDateTime(selectedDate, endTime);

  return (
    <div className="space-y-5">
      {/* Price row — shown unless hidePrice */}
      {!hidePrice && (
        <div className="flex items-end justify-between gap-3">
          <div className={`text-[32px] font-semibold leading-none tracking-[-0.05em] ${dark ? "text-white" : "text-slate-950"}`}>
            {formatListingPriceLine({
              pricePerDay: pricePerDay ?? 0,
              pricePerHour: pricePerHour ?? null,
              rateType: rateType ?? "daily",
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            className={`mb-0.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              dark
                ? "border-white/[0.1] text-slate-400 hover:bg-white/[0.06]"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Change
          </button>
        </div>
      )}

      {/* Date + time summary */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className={`text-[13px] ${dark ? "text-slate-500" : "text-slate-400"}`}>
            {selectedDayLabel}
          </p>
          {hidePrice && (
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                dark
                  ? "border-white/[0.1] text-slate-400 hover:bg-white/[0.06]"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Change
            </button>
          )}
        </div>
        <p className={`text-[28px] font-semibold leading-tight tracking-[-0.04em] ${dark ? "text-white" : "text-slate-950"}`}>
          {startTime}{" "}
          <span className={`font-light ${dark ? "text-white/20" : "text-slate-300"}`}>→</span>{" "}
          {endTime}
        </p>
      </div>

      <Link
        href={href as any}
        className="inline-flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-600"
      >
        Continue to booking
      </Link>

      {/* Edit modal */}
      {showEditor ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 sm:items-center sm:px-4"
          onClick={() => setShowEditor(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-[0_8px_40px_rgba(15,23,42,0.22)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — visible on mobile only */}
            <div className="flex justify-center bg-slate-950 pt-3 sm:hidden">
              <div className="h-1 w-8 rounded-full bg-white/20" />
            </div>

            {/* Dark header */}
            <div className="bg-slate-950 px-6 pb-5 pt-3 sm:pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-500">
                    Edit booking
                  </p>
                  <h3 className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.03em] text-white">
                    Date &amp; time
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-5 px-6 py-5">
              {/* Quick-select chips */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Quick select
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {([
                    { label: "2 hrs", start: "09:00", end: "11:00" },
                    { label: "4 hrs", start: "09:00", end: "13:00" },
                    { label: "Full day", start: "08:00", end: "20:00" },
                    { label: "Evening", start: "17:00", end: "22:00" },
                  ] as const).map((preset) => {
                    const active = startTime === preset.start && endTime === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => { setStartTime(preset.start); setEndTime(preset.end); }}
                        className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                          active
                            ? "border-brand-500 bg-brand-500 text-white"
                            : "border-slate-200 text-slate-600 hover:border-brand-500 hover:text-brand-600"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Parking date
                </p>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-4 text-[15px] font-semibold text-slate-950 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    From
                  </p>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-4 text-[15px] font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Until
                  </p>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-4 text-[15px] font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="inline-flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
