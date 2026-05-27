"use client";

import type { HostStepProps } from "./types";

// ── Feature chips ─────────────────────────────────────────────────────────────

const FEATURES = [
  { label: "CCTV",           icon: <CctvIcon /> },
  { label: "EV charging",    icon: <ZapIcon /> },
  { label: "Sheltered",      icon: <ShelterIcon /> },
  { label: "Well lit",       icon: <LightIcon /> },
  { label: "Gated access",   icon: <FenceIcon /> },
  { label: "Height-friendly",icon: <HeightIcon /> },
];

function CctvIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="m16.75 12 3.58 7.18A2 2 0 0 1 18.54 22H5.46a2 2 0 0 1-1.79-2.82L7.25 12" />
      <rect x="7" y="2" width="10" height="10" rx="2" />
      <path d="m12 12 .01 0" />
    </svg>
  );
}
function ZapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function ShelterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="10" x="4" y="8" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 21v-3M16 21v-3" />
    </svg>
  );
}
function LightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6M10 22h4" />
    </svg>
  );
}
function FenceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3 2 5v15h4V5L4 3zM20 3l2 2v15h-4V5l2-2zM12 3l2 2v15h-4V5l2-2zM2 12h4M18 12h4M8 12h8" />
    </svg>
  );
}
function HeightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
    </svg>
  );
}

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
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Features</p>
          <p className="mt-1 text-base font-semibold text-slate-900">What else does your space offer?</p>
        </div>
        <div className="flex flex-col gap-2">
          {FEATURES.map(({ label, icon }) => {
            const active = data.amenities.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleFeature(label)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  active ? "border-[#2ECC8F] bg-white" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  active ? "bg-emerald-50 text-[#2ECC8F]" : "bg-slate-100 text-slate-500"
                }`}>
                  {icon}
                </div>
                <span className="flex-1 text-sm font-semibold text-slate-800">{label}</span>
                {active && (
                  <svg className="h-5 w-5 shrink-0 text-[#2ECC8F]" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Access ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Access</p>
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
                    ? "border-[#2ECC8F] text-slate-900"
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
            <p className="text-sm text-slate-500">What access feature applies to your space?</p>
            {ACCESS_CHOICES.map((choice) => {
              const active = data.accessType === choice.id;
              return (
                <div key={choice.id}>
                  <button
                    type="button"
                    onClick={() => selectAccessType(choice.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3.5 text-left transition ${
                      active ? "border-[#2ECC8F] bg-white" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className={`text-sm font-semibold ${active ? "text-slate-900" : "text-slate-700"}`}>
                      {choice.label}
                    </span>
                    {active && (
                      <svg className="h-5 w-5 shrink-0 text-[#2ECC8F]" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                      </svg>
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
