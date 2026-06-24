"use client";
import { Check } from "lucide-react";

import { useEffect, useRef, useState } from "react";
import type { SearchFilters } from "./SearchForm";

export function FiltersPanel({
  initialFilters,
  onApply,
  onCancel: _onCancel,
  onLiveChange,
  searchAsMove,
  onSearchAsMove,
}: {
  initialFilters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onCancel?: () => void;
  onLiveChange?: (filters: SearchFilters) => void;
  searchAsMove?: boolean;
  onSearchAsMove?: (v: boolean) => void;
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
    <div className="flex h-full min-h-0 flex-col bg-[#f8fafc]">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Refine results
            </p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-slate-900">
              Filters
            </h2>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-600">
            {activeFilterCount} active
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto space-y-4 p-4">

        {/* Search as I move */}
        {onSearchAsMove !== undefined && (
          <Section label="Map">
            <button
              type="button"
              onClick={() => onSearchAsMove(!searchAsMove)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-3"
            >
              <div className="text-left">
                <p className="text-[13px] font-semibold text-slate-800">Search as I move</p>
                <p className="text-[11.5px] text-slate-600">Re-search automatically when you pan the map</p>
              </div>
              <div className={`relative ml-4 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${searchAsMove ? "bg-brand-500" : "bg-slate-200"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${searchAsMove ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
            </button>
          </Section>
        )}

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
        <Section label="Price">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Min / day</p>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-slate-600">€</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={pending.priceMin ?? ""}
                  onChange={(e) => update("priceMin", e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-7 pr-3 text-[13px] font-semibold text-slate-900 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Max / day</p>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-slate-600">€</span>
                <input
                  type="number"
                  min={0}
                  placeholder="100"
                  value={pending.priceMax ?? ""}
                  onChange={(e) => update("priceMax", e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-7 pr-3 text-[13px] font-semibold text-slate-900 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
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
      <div
        className="border-t border-slate-200 bg-white px-4 py-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="flex gap-3">
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
          className="flex-1 rounded-lg border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          Clear {activeFilterCount > 0 ? `(${activeFilterCount})` : "all"}
        </button>
        <button
          type="button"
          onClick={() => onApply(pending)}
          className="flex-[2] rounded-lg bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
        >
          Apply filters
        </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <p className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-900">
        {label}
      </p>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
        active
          ? "border-brand-500 bg-brand-500 text-white shadow-sm"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900"
      }`}
    >
      {active && (
        <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />
      )}
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
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-[13px] font-semibold text-slate-900">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-[28px] w-[50px] shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none ${
          checked ? "border-transparent bg-brand-500" : "border-slate-300 bg-slate-200"
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
