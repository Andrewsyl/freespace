"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Day = {
  date: string;
  label: string;
  disabled: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit", timeZone: "UTC" });

function buildDays(bookedDates: string[] = []) {
  const today = new Date();
  // Normalize to UTC midnight for consistent SSR/CSR output
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

export function BookingSelector({
  listingId,
  bookedDates = [],
  pricePerDay,
}: {
  listingId: string;
  bookedDates?: string[];
  pricePerDay?: number;
}) {
  const days = useMemo(() => buildDays(bookedDates), [bookedDates]);
  const defaultDay = days.find((d) => !d.disabled)?.date ?? days[0]?.date;
  const [selectedDate, setSelectedDate] = useState(defaultDay);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const href = `/checkout/${listingId}?date=${selectedDate}&startTime=${startTime}&endTime=${endTime}`;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold text-slate-900">€{pricePerDay ?? ""}</div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b7280]">Session</span>
      </div>

      {/* Mobile-first: simple date + time rows */}
      <div className="space-y-3 lg:hidden">
        <div className="rounded-[14px] border border-[#e5e7eb] bg-white px-3 py-3">
          <label className="block text-xs font-semibold text-[#6b7280]">Departure date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm font-medium text-slate-700">
          <label className="flex flex-col gap-1">
            From
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            To
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
        </div>
      </div>

      {/* Desktop: calendar strip */}
      <div className="hidden grid-cols-5 gap-2 lg:grid">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            disabled={day.disabled}
            onClick={() => setSelectedDate(day.date)}
            className={`rounded-lg border px-2 py-2 text-sm font-semibold ${
              day.disabled
                ? "cursor-not-allowed border-slate-200 text-slate-300"
                : selectedDate === day.date
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 hover:border-brand-200"
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="hidden grid-cols-2 gap-3 text-sm font-medium text-slate-700 lg:grid">
        <label className="flex flex-col gap-1">
          From
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          To
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
      </div>

      <Link href={href as any} className="btn-primary w-full text-center">
        Start booking
      </Link>
      <p className="text-xs text-slate-500">
        Sundays and booked dates are disabled. Adjust times on the checkout page if needed.
      </p>
    </div>
  );
}
