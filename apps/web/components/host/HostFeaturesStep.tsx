"use client";

import { useState } from "react";
import type { HostStepProps } from "./types";
import { SectionLabel, SectionIntro, ChipToggle, RadioTile } from "./_ui";
import { Cctv, Zap, Home, Lightbulb, Lock, ArrowUpDown, Accessibility, Clock, Bike, Maximize2, Plus, Minus } from "lucide-react";

// ── Feature chips ─────────────────────────────────────────────────────────────

const COMMON_FEATURES = [
  { label: "CCTV",            icon: <Cctv size={15} strokeWidth={2.1} /> },
  { label: "EV charging",     icon: <Zap size={15} strokeWidth={2.1} /> },
  { label: "Sheltered",       icon: <Home size={15} strokeWidth={2.1} /> },
  { label: "Well lit",        icon: <Lightbulb size={15} strokeWidth={2.1} /> },
  { label: "Gated access",    icon: <Lock size={15} strokeWidth={2.1} /> },
];

const EXTRA_FEATURES = [
  { label: "Height-friendly",    icon: <ArrowUpDown size={15} strokeWidth={2.1} /> },
  { label: "Disabled access",    icon: <Accessibility size={15} strokeWidth={2.1} /> },
  { label: "24/7 access",        icon: <Clock size={15} strokeWidth={2.1} /> },
  { label: "Motorbike friendly", icon: <Bike size={15} strokeWidth={2.1} /> },
  { label: "Wide bay",           icon: <Maximize2 size={15} strokeWidth={2.1} /> },
];

const ACCESS_CHOICES = [
  { id: "key_fob",              label: "Key or security fob",   placeholder: "e.g. collect from unit 4 on arrival, or from the key box at the entrance." },
  { id: "pin_code",             label: "Pin code",              placeholder: "e.g. the code will be sent to you after your booking is confirmed." },
  { id: "special_instructions", label: "Special instructions",  placeholder: "e.g. ring unit 4, wait for the shutter, then take the second bay on the right." },
];

export function HostFeaturesStep({ data, onUpdate }: HostStepProps) {
  const [showAll, setShowAll] = useState(EXTRA_FEATURES.some((f) => data.amenities.includes(f.label)));

  const toggleFeature = (label: string) => {
    const has = data.amenities.includes(label);
    onUpdate({ amenities: has ? data.amenities.filter((a) => a !== label) : [...data.amenities, label] });
  };

  const selectAccessType = (id: string) => {
    onUpdate(data.accessType === id ? { accessType: undefined, accessInstructions: "" } : { accessType: id, accessInstructions: "" });
  };

  const features = [...COMMON_FEATURES, ...(showAll ? EXTRA_FEATURES : [])];

  return (
    <div className="space-y-10">

      {/* Features */}
      <div>
        <SectionIntro label="Features">What makes your space stand out? Select all that apply.</SectionIntro>
        <div className="flex flex-wrap gap-2">
          {features.map(({ label, icon }) => (
            <ChipToggle
              key={label}
              active={data.amenities.includes(label)}
              onClick={() => toggleFeature(label)}
              icon={icon}
            >
              {label}
            </ChipToggle>
          ))}
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-4 py-2.5 text-[13.5px] font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
          >
            {showAll ? <Minus size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
            {showAll ? "Fewer" : `More (${EXTRA_FEATURES.length})`}
          </button>
        </div>
      </div>

      {/* Access */}
      <div>
        <SectionIntro label="Access">
          Does a driver need a key, code, or special instructions to get in?
        </SectionIntro>

        {/* Segmented Yes / No */}
        <div className="grid grid-cols-2 gap-2">
          {(["No", "Yes"] as const).map((option) => {
            const isNo = option === "No";
            const active = isNo ? data.requiresAccessCode === false : data.requiresAccessCode === true;
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onUpdate({
                    requiresAccessCode: !isNo,
                    ...(isNo ? { accessType: undefined, accessInstructions: "" } : {}),
                  })
                }
                className={`flex h-12 items-center justify-center rounded-2xl border-2 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  active
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {isNo ? "No — open access" : "Yes — needs entry"}
              </button>
            );
          })}
        </div>

        {/* Access type */}
        {data.requiresAccessCode === true && (
          <div className="mt-4 space-y-2">
            <p className="text-[13px] font-medium text-slate-500">How do drivers get in?</p>
            {ACCESS_CHOICES.map((choice) => {
              const active = data.accessType === choice.id;
              return (
                <div key={choice.id}>
                  <RadioTile active={active} onClick={() => selectAccessType(choice.id)} title={choice.label} />
                  {active && (
                    <div className="mt-2 rounded-2xl border-2 border-slate-200 bg-white transition-colors focus-within:border-brand-600">
                      <textarea
                        value={data.accessInstructions ?? ""}
                        onChange={(e) => onUpdate({ accessInstructions: e.target.value })}
                        rows={3}
                        placeholder={choice.placeholder}
                        className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-[14px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
