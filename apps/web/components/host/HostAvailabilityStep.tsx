"use client";

import { useEffect, useState } from "react";
import type { HostStepProps } from "./types";

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

export function HostAvailabilityStep({ data, onUpdate }: HostStepProps) {
  const [preset, setPreset] = useState<AvailabilityPreset>(() => detectPreset(data.availabilityText));
  const [customOpen, setCustomOpen] = useState(false);
  const [days, setDays] = useState<DayCode[]>([]);
  const [ranges, setRanges] = useState<Record<DayCode, { start: string; end: string }>>(() => {
    const out = {} as Record<DayCode, { start: string; end: string }>;
    ALL_DAYS.forEach(d => { out[d] = { start: "08:00", end: "20:00" }; });
    return out;
  });

  // Set default on first load
  useEffect(() => {
    if (!data.availabilityText) {
      onUpdate({ availabilityText: "Available 24/7 — Monday to Sunday" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPreset = (next: AvailabilityPreset) => {
    setPreset(next);
    if (next === "always") {
      onUpdate({ availabilityText: "Available 24/7 — Monday to Sunday" });
    } else if (next === "working") {
      onUpdate({ availabilityText: "Monday to Friday, 06:00 – 19:00" });
    } else {
      setCustomOpen(true);
    }
  };

  const toggleDay = (day: DayCode) => {
    setDays(prev => {
      if (prev.includes(day)) return prev.filter(d => d !== day);
      const newDays = [...prev, day];
      // Inherit ranges from adjacent day
      const sorted = newDays.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
      const idx = sorted.indexOf(day);
      const source = sorted[idx - 1] ?? sorted[idx + 1];
      if (source) setRanges(r => ({ ...r, [day]: { ...r[source] } }));
      return newDays;
    });
  };

  const confirmCustom = () => {
    const text = buildText("custom", days, ranges);
    onUpdate({ availabilityText: text });
    setCustomOpen(false);
  };

  const customSummary = buildText("custom", days, ranges);

  return (
    <div className="space-y-3">
      {/* Always available */}
      <button
        type="button"
        onClick={() => selectPreset("always")}
        className={`w-full rounded-xl border p-5 text-left transition ${
          preset === "always" ? "border-brand-500 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <p className="text-base font-semibold text-slate-900">
          Always available
          <span className="ml-2 text-xs font-semibold text-brand-500">Recommended</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">Monday – Sunday (24 hours)</p>
      </button>

      {/* Working week */}
      <button
        type="button"
        onClick={() => selectPreset("working")}
        className={`w-full rounded-xl border p-5 text-left transition ${
          preset === "working" ? "border-brand-500 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <p className="text-base font-semibold text-slate-900">Working week</p>
        <p className="mt-1 text-sm text-slate-500">Monday – Friday (06:00 – 19:00)</p>
      </button>

      {/* Custom */}
      <button
        type="button"
        onClick={() => selectPreset("custom")}
        className={`flex w-full items-center justify-between rounded-xl border p-5 text-left transition ${
          preset === "custom" ? "border-brand-500 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <div>
          <p className="text-base font-semibold text-slate-900">Custom</p>
          <p className="mt-1 text-sm text-slate-500">Personalised settings</p>
        </div>
        <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6"/></svg>
      </button>

      {/* Custom summary */}
      {preset === "custom" && customSummary && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Selected schedule</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{customSummary}</p>
        </div>
      )}

      {/* Custom modal */}
      {customOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setCustomOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Custom availability</h3>
              <button type="button" onClick={() => setCustomOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">Choose the days and times you want to make your space available.</p>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {ALL_DAYS.map(day => {
                const enabled = days.includes(day);
                return (
                  <div key={day} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{DAY_LABELS[day]}</span>
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
                        <div className="flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Start</p>
                          <select
                            value={ranges[day].start}
                            onChange={e => setRanges(r => ({ ...r, [day]: { ...r[day], start: e.target.value } }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none"
                          >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">End</p>
                          <select
                            value={ranges[day].end}
                            onChange={e => setRanges(r => ({ ...r, [day]: { ...r[day], end: e.target.value } }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none"
                          >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
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
              className="mt-4 w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-40"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
