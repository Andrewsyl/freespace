"use client";
import { X } from "lucide-react";

import { useEffect, useState } from "react";
import type { HostStepProps } from "./types";
import { SectionIntro, RadioTile, TipCallout } from "./_ui";

type DayCode = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type AvailabilityPreset = "always" | "working" | "custom";

const ALL_DAYS: DayCode[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS: Record<DayCode, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

function buildText(preset: AvailabilityPreset, days: DayCode[], ranges: Record<DayCode, { start: string; end: string }>): string {
  if (preset === "always") return "Available 24/7 — Monday to Sunday";
  if (preset === "working") return "Monday to Friday, 06:00 – 19:00";
  if (!days.length) return "";
  const sorted = [...days].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
  return sorted.map(d => `${DAY_LABELS[d]} ${ranges[d].start}–${ranges[d].end}`).join(", ");
}

function detectPreset(text: string): AvailabilityPreset {
  if (!text || text === "Available 24/7 — Monday to Sunday") return "always";
  if (text === "Monday to Friday, 06:00 – 19:00") return "working";
  return "custom";
}

const PRESETS = [
  { key: "always" as const,  label: "Always available", description: "Monday – Sunday, 24 hours",       badge: "Recommended" },
  { key: "working" as const, label: "Working week",     description: "Monday – Friday, 06:00 – 19:00" },
  { key: "custom" as const,  label: "Custom schedule",  description: "Choose your own days and hours" },
];

export function HostAvailabilityStep({ data, onUpdate }: HostStepProps) {
  const [preset, setPreset] = useState<AvailabilityPreset>(() => detectPreset(data.availabilityText));
  const [customOpen, setCustomOpen] = useState(false);
  const [days, setDays] = useState<DayCode[]>([]);
  const [ranges, setRanges] = useState<Record<DayCode, { start: string; end: string }>>(() => {
    const out = {} as Record<DayCode, { start: string; end: string }>;
    ALL_DAYS.forEach(d => { out[d] = { start: "08:00", end: "20:00" }; });
    return out;
  });

  useEffect(() => {
    if (!data.availabilityText) onUpdate({ availabilityText: "Available 24/7 — Monday to Sunday" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPreset = (next: AvailabilityPreset) => {
    setPreset(next);
    if (next === "always") onUpdate({ availabilityText: "Available 24/7 — Monday to Sunday" });
    else if (next === "working") onUpdate({ availabilityText: "Monday to Friday, 06:00 – 19:00" });
    else setCustomOpen(true);
  };

  const toggleDay = (day: DayCode) => {
    setDays(prev => {
      if (prev.includes(day)) return prev.filter(d => d !== day);
      const newDays = [...prev, day].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
      const idx = newDays.indexOf(day);
      const source = newDays[idx - 1] ?? newDays[idx + 1];
      if (source) setRanges(r => ({ ...r, [day]: { ...r[source] } }));
      return newDays;
    });
  };

  const confirmCustom = () => {
    onUpdate({ availabilityText: buildText("custom", days, ranges) });
    setCustomOpen(false);
  };

  const customSummary = buildText("custom", days, ranges);

  return (
    <div className="space-y-10">
      <div>
        <SectionIntro label="Availability">When can drivers book your space?</SectionIntro>
        <div className="space-y-2">
          {PRESETS.map(({ key, label, description, badge }) => (
            <RadioTile
              key={key}
              active={preset === key}
              onClick={() => selectPreset(key)}
              title={label}
              description={description}
              trailing={badge ? (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                  {badge}
                </span>
              ) : undefined}
            />
          ))}
        </div>

        {/* Custom summary */}
        {preset === "custom" && customSummary && (
          <div className="mt-3 flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Selected schedule</p>
              <p className="mt-1 text-[14px] font-medium text-slate-800">{customSummary}</p>
            </div>
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="shrink-0 text-[13px] font-semibold text-brand-600 transition hover:text-brand-800"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <TipCallout title="More availability means more bookings">
        Spaces available 24/7 are booked far more often. You can adjust this any time from your dashboard.
      </TipCallout>

      {/* Custom modal */}
      {customOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center"
          onClick={() => setCustomOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[18px] font-bold tracking-[-0.01em] text-slate-900">Custom availability</h3>
              <button type="button" onClick={() => setCustomOpen(false)} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
            <p className="mb-4 text-[14px] leading-relaxed text-slate-500">
              Toggle the days you’re available and set the hours for each.
            </p>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {ALL_DAYS.map(day => {
                const enabled = days.includes(day);
                return (
                  <div key={day} className={`rounded-xl border p-3 transition-colors ${enabled ? "border-brand-200 bg-brand-50" : "border-slate-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-slate-800">{DAY_LABELS[day]}</span>
                      <button
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-brand-500" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    {enabled && (
                      <div className="mt-3 flex gap-3">
                        {(["start", "end"] as const).map((edge) => (
                          <div key={edge} className="flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{edge}</p>
                            <select
                              value={ranges[day][edge]}
                              onChange={e => setRanges(r => ({ ...r, [day]: { ...r[day], [edge]: e.target.value } }))}
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] font-semibold text-slate-800 transition-colors focus:border-brand-600 focus:outline-none"
                            >
                              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={confirmCustom}
              disabled={days.length === 0}
              className="mt-5 w-full rounded-xl bg-brand-600 py-3.5 text-[15px] font-bold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-40"
            >
              Confirm schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
