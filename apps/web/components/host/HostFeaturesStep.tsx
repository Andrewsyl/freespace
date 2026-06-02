"use client";

import { useState } from "react";
import type { HostStepProps } from "./types";
import { Camera, Zap, Home, Lightbulb, Lock, ArrowUpDown, CheckCircle, Accessibility, Clock, Bike, Maximize2 } from "lucide-react";

// ── Feature chips ─────────────────────────────────────────────────────────────

const COMMON_FEATURES = [
  { label: "CCTV",           icon: <Camera size={16} strokeWidth={2.1} /> },
  { label: "EV charging",    icon: <Zap size={16} strokeWidth={2.1} /> },
  { label: "Sheltered",      icon: <Home size={16} strokeWidth={2.1} /> },
  { label: "Well lit",       icon: <Lightbulb size={16} strokeWidth={2.1} /> },
  { label: "Gated access",   icon: <Lock size={16} strokeWidth={2.1} /> },
];

const EXTRA_FEATURES = [
  { label: "Height-friendly",   icon: <ArrowUpDown size={16} strokeWidth={2.1} /> },
  { label: "Disabled access",   icon: <Accessibility size={16} strokeWidth={2.1} /> },
  { label: "24/7 access",       icon: <Clock size={16} strokeWidth={2.1} /> },
  { label: "Motorbike friendly", icon: <Bike size={16} strokeWidth={2.1} /> },
  { label: "Wide bay",          icon: <Maximize2 size={16} strokeWidth={2.1} /> },
];

// ── Access choices ────────────────────────────────────────────────────────────

const ACCESS_CHOICES = [
  {
    id: "key_fob",
    label: "Requires a key or security fob",
    placeholder: "e.g. collect from unit 4 on arrival, or pick up from the key box at the entrance.",
  },
  {
    id: "pin_code",
    label: "Requires a pin code",
    placeholder: "e.g. the code will be sent to you after booking confirmation.",
  },
  {
    id: "special_instructions",
    label: "Requires special instructions",
    placeholder: "e.g. ring unit 4, wait for the shutter, then use the second bay on the right.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function HostFeaturesStep({ data, onUpdate }: HostStepProps) {
  const [showAllFeatures, setShowAllFeatures] = useState(
    EXTRA_FEATURES.some((f) => data.amenities.includes(f.label))
  );

  const toggleFeature = (label: string) => {
    const has = data.amenities.includes(label);
    onUpdate({
      amenities: has ? data.amenities.filter((a) => a !== label) : [...data.amenities, label],
    });
  };

  const selectAccessType = (id: string) => {
    // toggling off if already selected
    if (data.accessType === id) {
      onUpdate({ accessType: undefined, accessInstructions: "" });
    } else {
      onUpdate({ accessType: id, accessInstructions: "" });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Features ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">Features</p>
          <p className="mt-1 text-base font-semibold text-slate-900">What else does your space offer?</p>
        </div>
        <div className="flex flex-col gap-2">
          {[...COMMON_FEATURES, ...(showAllFeatures ? EXTRA_FEATURES : [])].map(({ label, icon }) => {
            const active = data.amenities.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleFeature(label)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  active ? "border-brand-500 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  active ? "bg-brand-50 text-brand-500" : "bg-slate-100 text-slate-500"
                }`}>
                  {icon}
                </div>
                <span className="flex-1 text-sm font-semibold text-slate-800">{label}</span>
                {active && (
                  <CheckCircle className="h-5 w-5 shrink-0 text-brand-500" fill="none" strokeWidth={2} />
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowAllFeatures((v) => !v)}
            className="mt-1 text-left text-[13px] font-semibold text-brand-500 hover:text-brand-600"
          >
            {showAllFeatures ? "Show less" : `More features +${EXTRA_FEATURES.length}`}
          </button>
        </div>
      </div>

      {/* ── Access ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">Access</p>
          <p className="mt-1 text-base font-semibold leading-snug text-slate-900">
            Does your space have gated entry or require a key or extra info?
          </p>
        </div>

        {/* Yes / No toggle */}
        <div className="flex gap-3">
          {(["No", "Yes"] as const).map((option) => {
            const isNo = option === "No";
            const active = isNo ? data.requiresAccessCode === false : data.requiresAccessCode === true;
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onUpdate({
                    requiresAccessCode: isNo ? false : true,
                    ...(isNo ? { accessType: undefined, accessInstructions: "" } : {}),
                  })
                }
                className={`flex h-12 flex-1 items-center justify-center rounded-lg border text-sm font-semibold transition ${
                  active
                    ? "border-brand-500 text-slate-900"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {/* Access type choices — shown if Yes */}
        {data.requiresAccessCode === true && (
          <div className="space-y-2 pt-1">
            <p className="text-sm text-slate-500">How do drivers get into your space?</p>
            {ACCESS_CHOICES.map((choice) => {
              const active = data.accessType === choice.id;
              return (
                <div key={choice.id}>
                  <button
                    type="button"
                    onClick={() => selectAccessType(choice.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3.5 text-left transition ${
                      active ? "border-brand-500 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className={`text-sm font-semibold ${active ? "text-slate-900" : "text-slate-700"}`}>
                      {choice.label}
                    </span>
                    {active && (
                      <CheckCircle className="h-5 w-5 shrink-0 text-brand-500" strokeWidth={2} />
                    )}
                  </button>

                  {/* Detail input — shown when this type is selected */}
                  {active && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <textarea
                        value={data.accessInstructions ?? ""}
                        onChange={(e) => onUpdate({ accessInstructions: e.target.value })}
                        rows={3}
                        placeholder={choice.placeholder}
                        className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
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
