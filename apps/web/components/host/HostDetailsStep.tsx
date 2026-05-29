"use client";

import type { HostStepProps } from "./types";

// ── Space types ──────────────────────────────────────────────────────────────

const SPACE_TYPES = ["Private Driveway", "Garage", "Car park", "Private road"];

function SpaceTypeIcon({ type, size = 20 }: { type: string; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "Private Driveway":
      return (
        <svg {...props}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "Garage":
      return (
        <svg {...props}>
          <path d="M3 9.5 12 3l9 6.5V21H3V9.5Z" />
          <path d="M8 21v-6h8v6M8 15h8M10 12h4" />
        </svg>
      );
    case "Car park":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8h3a2 2 0 0 1 0 4h-3V8zm0 4v4" />
        </svg>
      );
    default: // Private road
      return (
        <svg {...props}>
          <path d="M12 3v18M8 6l4-3 4 3M8 18l4 3 4-3M5 9h14M5 15h14" />
        </svg>
      );
  }
}

// ── Vehicle sizes ─────────────────────────────────────────────────────────────

const VEHICLE_SIZES = [
  { value: "small",  label: "Small",  example: "e.g. VW Polo, Ford Fiesta",      emoji: "🚗" },
  { value: "medium", label: "Medium", example: "e.g. Audi A3, Toyota Camry",     emoji: "🚙" },
  { value: "large",  label: "Large",  example: "e.g. Volvo XC90, BMW X5",        emoji: "🚐" },
  { value: "van",    label: "Van",    example: "e.g. Transit Custom, Sprinter",  emoji: "🚌" },
];

const MIN_COUNT = 0;
const MAX_COUNT = 99;

// ── Component ─────────────────────────────────────────────────────────────────

export function HostDetailsStep({ data, onUpdate }: HostStepProps) {
  const spaceCount = parseInt(data.spaceCount ?? "0", 10) || 0;
  const hasType  = Boolean(data.spaceType);
  const hasCount = spaceCount > 0;

  const adjustCount = (delta: number) => {
    const next = Math.min(MAX_COUNT, Math.max(MIN_COUNT, spaceCount + delta));
    onUpdate({ spaceCount: next > 0 ? String(next) : "" });
  };

  // ── Phase 1: no type yet ──────────────────────────────────────────────────
  if (!hasType) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Pick the shape that best matches your space</p>
        <div className="grid grid-cols-2 gap-3">
          {SPACE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onUpdate({ spaceType: type })}
              className="flex min-h-[110px] flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <SpaceTypeIcon type={type} />
              </div>
              <p className="text-base font-bold tracking-tight text-slate-900">{type}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Phase 2 / 3 / 4: type selected ───────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Collapsed type row — tap to change */}
      <button
        type="button"
        onClick={() => onUpdate({ spaceType: undefined, spaceCount: "", vehicleSize: undefined })}
        className="flex w-full items-center gap-3 rounded-lg border border-[#ff6363] bg-white px-4 py-3.5 text-left transition hover:bg-brand-50"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <SpaceTypeIcon type={data.spaceType!} />
        </div>
        <span className="flex-1 text-base font-bold tracking-tight text-slate-900">{data.spaceType}</span>
        {/* Green checkmark */}
        <svg className="h-5 w-5 shrink-0 text-[#ff6363]" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Space count ────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm text-slate-500">How many spaces are available to rent out?</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => adjustCount(-1)}
            disabled={spaceCount <= MIN_COUNT}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            −
          </button>
          <div className="flex h-14 w-20 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-2xl font-bold text-slate-900">
            {spaceCount}
          </div>
          <button
            type="button"
            onClick={() => adjustCount(1)}
            disabled={spaceCount >= MAX_COUNT}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Vehicle size — only appears once count > 0 ────────────────────────── */}
      {hasCount && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">Vehicle fit</p>
            <p className="mt-1 text-sm text-slate-500">What size vehicles fit your space?</p>
          </div>
          <div className="space-y-2">
            {VEHICLE_SIZES.map((opt) => {
              const active = data.vehicleSize === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdate({ vehicleSize: opt.value })}
                  className={`flex w-full items-center gap-4 rounded-lg border px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                    active ? "border-[#ff6363] bg-white" : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold tracking-tight text-slate-900">{opt.label}</p>
                    <p className="text-sm text-slate-500">{opt.example}</p>
                  </div>
                  {active && (
                    <svg className="h-5 w-5 shrink-0 text-[#ff6363]" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
