"use client";

import { Minus, Plus } from "lucide-react";
import type { HostStepProps } from "./types";
import { RadioTile, SectionLabel, SectionIntro } from "./_ui";

const SPACE_TYPES = [
  { label: "Driveway",     description: "Outside your home — on or off the road" },
  { label: "Garage",       description: "Private covered garage or lock-up"       },
  { label: "Car park",     description: "Off-street car park or private lot"       },
  { label: "Private road", description: "Gated estate or private access road"     },
];

const VEHICLE_SIZES = [
  { value: "small",  label: "Hatchback",      example: "Fits cars up to ~4.2 m" },
  { value: "medium", label: "Saloon / Estate", example: "Fits cars up to ~4.8 m" },
  { value: "large",  label: "SUV / 4×4",      example: "Fits cars up to ~5.2 m" },
  { value: "van",    label: "Van",             example: "Fits vans & minibuses"   },
];

export function HostDetailsStep({ data, onUpdate }: HostStepProps) {
  const spaceCount = parseInt(data.spaceCount ?? "0", 10) || 0;
  const hasType    = Boolean(data.spaceType);
  const hasCount   = spaceCount > 0;

  const adjust = (delta: number) => {
    const next = Math.max(0, Math.min(99, spaceCount + delta));
    onUpdate({ spaceCount: next > 0 ? String(next) : "" });
  };

  /* ── Phase 1: pick type ── */
  if (!hasType) {
    return (
      <div>
        <p className="mb-5 text-[14px] text-slate-500">
          Select the option that best describes your space.
        </p>
        <div className="space-y-2.5">
          {SPACE_TYPES.map(({ label, description }) => (
            <RadioTile
              key={label}
              active={false}
              onClick={() => onUpdate({ spaceType: label })}
              title={label}
              description={description}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Phase 2+: type chosen ── */
  return (
    <div className="space-y-10">

      {/* Selected type */}
      <div>
        <SectionLabel>Space type</SectionLabel>
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3.5">
          <div>
            <p className="text-[15px] font-semibold text-slate-900">{data.spaceType}</p>
            <p className="text-[13px] text-slate-500">
              {SPACE_TYPES.find(t => t.label === data.spaceType)?.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdate({ spaceType: undefined, spaceCount: "", vehicleSize: undefined })}
            className="ml-4 shrink-0 rounded-md text-[13px] font-semibold text-brand-700 transition hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Change
          </button>
        </div>
      </div>

      {/* Space count */}
      <div>
        <SectionIntro label="Number of spaces">How many spaces can be booked at the same time?</SectionIntro>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={spaceCount <= 0}
            aria-label="Decrease number of spaces"
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-300 text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            <Minus className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
          <span className="w-16 text-center text-[44px] font-extrabold tabular-nums tracking-[-0.04em] text-slate-900">
            {spaceCount}
          </span>
          <button
            type="button"
            onClick={() => adjust(1)}
            disabled={spaceCount >= 99}
            aria-label="Increase number of spaces"
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-300 text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Max vehicle size */}
      {hasCount && (
        <div>
          <SectionIntro label="Maximum vehicle size">The largest vehicle that fits comfortably.</SectionIntro>
          <div className="space-y-2.5">
            {VEHICLE_SIZES.map(({ value, label, example }) => (
              <RadioTile
                key={value}
                active={data.vehicleSize === value}
                onClick={() => onUpdate({ vehicleSize: value })}
                title={label}
                description={example}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
