"use client";

import { TextAreaField } from "../ui";
import type { HostStepProps } from "./types";

const QUICK_PRESETS = [
  "Available 24/7",
  "Weekdays 07:00 - 19:00",
  "Weekends only",
  "Evenings after 18:00",
];

export function HostAvailabilityStep({ data, onUpdate }: HostStepProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onUpdate({ availabilityText: preset })}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {preset}
          </button>
        ))}
      </div>
      <TextAreaField
        label="Describe when the space is available"
        value={data.availabilityText}
        onChange={(e) => onUpdate({ availabilityText: e.target.value })}
        rows={4}
        placeholder="Example: Available 24/7, please call on arrival for gate code."
        hint="This text appears on your listing. Keep it simple and clear."
      />
    </div>
  );
}
