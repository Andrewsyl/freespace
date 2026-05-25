"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchFilters } from "./SearchForm";

export function FiltersPanel({
  initialFilters,
  onApply,
  onCancel: _onCancel,
  onLiveChange,
}: {
  initialFilters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onCancel?: () => void;
  onLiveChange?: (filters: SearchFilters) => void;
}) {
  const [pending, setPending] = useState<SearchFilters>(initialFilters);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => { setPending(initialFilters); }, [initialFilters]);

  const update = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    setPending((prev) => ({ ...prev, [key]: value }));

  // Debounced live-change for desktop
  useEffect(() => {
    if (!onLiveChange) return;
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onLiveChange(pending), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [pending, onLiveChange]);

  const activeFilterCount = [
    pending.priceMin, pending.priceMax, pending.securityLevel,
    pending.vehicleSize, pending.spaceType, pending.coveredParking, pending.evCharging, pending.instantBook,
  ].filter(Boolean).length;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f5f7fb]">
      <div className="flex-1 space-y-3 p-4">

        {/* Mode */}
        <Section label="Mode">
          <div className="flex gap-2">
            {(["daily", "monthly"] as const).map((mode) => (
              <Chip
                key={mode}
                label={mode === "daily" ? "Daily" : "Monthly"}
                active={pending.mode === mode}
                onClick={() => update("mode", mode)}
              />
            ))}
          </div>
        </Section>

        {/* Price */}
        <Section label="Price per day">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[#6B7280]">Min € / day</p>
              <input
                type="number"
                min={0}
                placeholder="10"
                value={pending.priceMin ?? ""}
                onChange={(e) => update("priceMin", e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0f172a] shadow-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[#6B7280]">Max € / day</p>
              <input
                type="number"
                min={0}
                placeholder="40"
                value={pending.priceMax ?? ""}
                onChange={(e) => update("priceMax", e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0f172a] shadow-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </Section>

        {/* Vehicle size */}
        <Section label="Vehicle size">
          <div className="flex flex-wrap gap-2">
            {(["motorcycle", "car", "van"] as const).map((size) => (
              <Chip
                key={size}
                label={size === "van" ? "Van / large" : size.charAt(0).toUpperCase() + size.slice(1)}
                active={pending.vehicleSize === size}
                onClick={() => update("vehicleSize", pending.vehicleSize === size ? undefined : size)}
              />
            ))}
          </div>
        </Section>

        {/* Space type */}
        <Section label="Space type">
          <div className="flex flex-wrap gap-2">
            {(["Private Driveway", "Garage", "Car park", "Private road"] as const).map((type) => (
              <Chip
                key={type}
                label={type}
                active={pending.spaceType === type}
                onClick={() => update("spaceType", pending.spaceType === type ? undefined : type)}
              />
            ))}
          </div>
        </Section>

        {/* Security */}
        <Section label="Security level">
          <div className="flex flex-wrap gap-2">
            {(["basic", "gated", "cctv"] as const).map((level) => (
              <Chip
                key={level}
                label={level === "cctv" ? "CCTV" : level.charAt(0).toUpperCase() + level.slice(1)}
                active={pending.securityLevel === level}
                onClick={() => update("securityLevel", pending.securityLevel === level ? undefined : level)}
              />
            ))}
          </div>
        </Section>

        {/* Preferences */}
        <Section label="Preferences">
          <div className="space-y-3">
            <ToggleRow
              label="Instant book only"
              checked={!!pending.instantBook}
              onChange={(v) => update("instantBook", v)}
            />
            <ToggleRow
              label="Covered parking"
              checked={!!pending.coveredParking}
              onChange={(v) => update("coveredParking", v)}
            />
            <ToggleRow
              label="EV charging"
              checked={!!pending.evCharging}
              onChange={(v) => update("evCharging", v)}
            />
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="border-t border-[#E5E7EB] bg-white px-4 py-4 flex gap-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
        <button
          type="button"
          onClick={() => {
            const cleared: SearchFilters = {
              ...pending,
              priceMin: undefined, priceMax: undefined,
              coveredParking: undefined, evCharging: undefined,
              securityLevel: undefined, vehicleSize: undefined,
              spaceType: undefined, instantBook: undefined,
            };
            setPending(cleared);
          }}
          className="flex-1 rounded-xl border border-[#E5E7EB] py-3 text-sm font-semibold text-[#374151] transition hover:bg-slate-50"
        >
          Clear {activeFilterCount > 0 ? `(${activeFilterCount})` : "all"}
        </button>
        <button
          type="button"
          onClick={() => onApply(pending)}
          className="flex-[2] rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
        >
          Apply filters
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white px-4 py-3">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-[7px] text-sm font-semibold transition ${
        active
          ? "bg-brand-500 text-white"
          : "bg-[#f5f7fb] text-[#6B7280] hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-semibold text-[#0f172a]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-[28px] w-[50px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
          checked ? "bg-brand-500" : "bg-[#D1D5DB]"
        }`}
      >
        <span
          className={`inline-block h-[24px] w-[24px] transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-[22px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
