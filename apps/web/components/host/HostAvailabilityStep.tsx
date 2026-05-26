"use client";

import type { HostStepProps } from "./types";

const QUICK_PRESETS = [
  "Available 24/7",
  "Weekdays 07:00 – 19:00",
  "Weekends only",
  "Evenings after 18:00",
  "Mon – Fri daytime",
  "Overnight 20:00 – 08:00",
];

export function HostAvailabilityStep({ data, onUpdate }: HostStepProps) {
  return (
    <div className="space-y-5">
      {/* Quick presets */}
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Select a common pattern or describe it below</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map((preset) => {
            const active = data.availabilityText === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onUpdate({ availabilityText: active ? "" : preset })}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-emerald-100 text-emerald-800 ring-1 ring-[#2ECC8F]"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      {/* Free-text description */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-800">Or describe your availability</label>
        <textarea
          value={data.availabilityText}
          onChange={(e) => onUpdate({ availabilityText: e.target.value })}
          rows={3}
          placeholder="e.g. Available 24/7 — call on arrival for gate code."
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2ECC8F] focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <p className="text-xs text-slate-400">This text appears on your public listing.</p>
      </div>
    </div>
  );
}
