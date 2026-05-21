"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDaysIcon, ClockIcon } from "@heroicons/react/24/outline";
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
}: {
  listingId: string;
  bookedDates?: string[];
  pricePerDay?: number;
  pricePerHour?: number | null;
  rateType?: "hourly" | "daily" | null;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">
          {formatListingPriceLine({
            pricePerDay: pricePerDay ?? 0,
            pricePerHour: pricePerHour ?? null,
            rateType: rateType ?? "daily",
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowEditor(true)}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Change
        </button>
      </div>

      <div className="rounded-[22px] border border-slate-200 bg-slate-50">
        <div className="flex items-center gap-4 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
            <CalendarDaysIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Date</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">{selectedDayLabel}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-200">
          <div className="flex items-center gap-4 px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
              <ClockIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">From</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{startTime}</p>
            </div>
          </div>
          <div className="border-l border-slate-200 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Until</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{endTime}</p>
          </div>
        </div>
      </div>

      <Link
        href={href as any}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-brand-500 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
      >
        Continue to booking
      </Link>

      {showEditor ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 px-4" onClick={() => setShowEditor(false)}>
          <div
            className="w-full max-w-[940px] rounded-[32px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto max-w-3xl">
              <h3 className="text-center text-[26px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[32px]">
                Edit your date or time below
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-center text-[17px] leading-8 text-slate-600">
                The price or availability may change based on the new date or time that you select.
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
                className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-brand-500 px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-brand-600"
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
