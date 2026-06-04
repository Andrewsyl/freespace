"use client";

import type { HostStepProps } from "./types";

const OPTIONS = [
  {
    id: "Private Driveway",
    label: "Private Driveway",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline strokeLinecap="round" strokeLinejoin="round" points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    detail: "Easy pull-in right outside a home.",
  },
  {
    id: "Garage",
    label: "Garage",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5 12 3l9 6.5V21H3V9.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-6h8v6M8 15h8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 12h4" />
      </svg>
    ),
    detail: "Sheltered space with extra weather protection.",
  },
  {
    id: "Car park",
    label: "Car park",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="12" cy="12" r="9" strokeLinecap="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 8h3a2 2 0 0 1 0 4h-3V8zm0 4v4" />
      </svg>
    ),
    detail: "Marked bay in a shared or private car park.",
  },
  {
    id: "Private road",
    label: "Private road",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 6l4-3 4 3M8 18l4 3 4-3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 9h14M5 15h14" />
      </svg>
    ),
    detail: "Reserved kerbside or private road spot.",
  },
];

export function HostSpaceTypeStep({ data, onUpdate }: HostStepProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Pick the shape that best matches your space</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = data.spaceType === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onUpdate({ spaceType: option.id })}
              className={`relative flex min-h-[110px] flex-col gap-3 rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                selected
                  ? "border-brand-400 bg-brand-50 shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    selected ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {option.icon}
                </div>
                {selected && (
                  <svg className="h-5 w-5 text-brand-500" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-base font-bold tracking-tight ${selected ? "text-brand-800" : "text-slate-900"}`}>
                  {option.label}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">{option.detail}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
