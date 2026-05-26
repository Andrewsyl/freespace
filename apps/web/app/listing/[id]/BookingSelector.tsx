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
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4"
          onClick={() => setShowEditor(false)}
        >
          <div
            className="w-full max-w-[940px] rounded-[32px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:p-8 lg:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-w-3xl">
              <h3 className="text-center text-[26px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[32px]">
                Edit your date or time
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-center text-[17px] leading-8 text-slate-500">
                The price or availability may change based on the date or time you select.
              </p>

              <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <label className="block">
                  <span className="text-[13px] font-semibold text-slate-800">Parking date</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="mt-3 h-16 w-full rounded-[18px] border border-slate-200 bg-white px-5 text-[18px] font-semibold text-slate-950 focus:border-brand-500 focus:outline-none"
                  />
                </label>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">Parking from</p>
                    <div className="mt-3 rounded-[18px] border border-slate-200 bg-white px-5 py-4">
                      <p className="text-[18px] font-semibold text-slate-950">{startSummary}</p>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="mt-3 h-12 w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">Parking until</p>
                    <div className="mt-3 rounded-[18px] border border-slate-200 bg-white px-5 py-4">
                      <p className="text-[18px] font-semibold text-slate-950">{endSummary}</p>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="mt-3 h-12 w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-brand-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-brand-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
