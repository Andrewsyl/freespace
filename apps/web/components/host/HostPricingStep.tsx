"use client";

import { useEffect, useState } from "react";
import type { HostStepProps } from "./types";

function ClockIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function CalendarIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}

const PRICING_MODES = [
  { key: "hourly_daily", label: "Hourly / Daily" },
  { key: "monthly",      label: "Monthly" },
  { key: "both",         label: "Both" },
] as const;

const DEFAULT_HOURLY  = 1;
const DEFAULT_DAILY   = 12;
const DEFAULT_MONTHLY = 100;

function sanitize(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, ...rest] = normalized.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

function parseMoney(value: string) {
  const parsed = parseFloat(value);
  return isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

function PricingRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-slate-800">{icon}</span>
        <span className="text-base font-bold text-slate-900">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-slate-800">€</span>
        <div className="min-w-[120px] rounded-xl border border-slate-200 bg-white px-4 py-3.5">
          <input
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => onChange(sanitize(e.target.value))}
            placeholder="0.00"
            className="w-full bg-transparent text-lg font-bold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      </div>
    </div>
  );
}

export function HostPricingStep({ data, onUpdate }: HostStepProps) {
  const pricingMode = data.pricingMode ?? "both";

  const [hourly,  setHourly]  = useState(String(data.pricePerHour  ?? DEFAULT_HOURLY));
  const [daily,   setDaily]   = useState(String(data.pricePerDay   ?? DEFAULT_DAILY));
  const [monthly, setMonthly] = useState(String(data.pricePerMonth ?? DEFAULT_MONTHLY));

  useEffect(() => {
    onUpdate({
      pricePerHour:  parseMoney(hourly)  ?? undefined,
      pricePerDay:   parseMoney(daily)   ?? undefined,
      pricePerMonth: parseMoney(monthly) ?? undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourly, daily, monthly]);

  const hourlyVal  = parseMoney(hourly)  ?? 0;
  const dailyVal   = parseMoney(daily)   ?? 0;
  const pricingWarning =
    hourlyVal > 0 && dailyVal > 0 && dailyVal > hourlyVal * 24
      ? `Your daily price (€${dailyVal.toFixed(2)}) is higher than 24× your hourly rate (€${(hourlyVal * 24).toFixed(2)}). Drivers would pay less booking 24 individual hours.`
      : null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Choose whether this space is for short stays, monthly commuter parking, or both.
      </p>

      {/* Mode tabs */}
      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1.5">
        {PRICING_MODES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onUpdate({ pricingMode: key })}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              pricingMode === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Price rows */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {(pricingMode === "hourly_daily" || pricingMode === "both") && (
          <PricingRow icon={<ClockIcon />} label="Hourly" value={hourly} onChange={setHourly} />
        )}
        {(pricingMode === "hourly_daily" || pricingMode === "both") && (
          <PricingRow icon={<CalendarIcon />} label="Daily" value={daily} onChange={setDaily} />
        )}
        {(pricingMode === "monthly" || pricingMode === "both") && (
          <PricingRow icon={<CalendarIcon />} label="Monthly" value={monthly} onChange={setMonthly} />
        )}
      </div>

      {/* Pricing conflict warning */}
      {pricingWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <p className="text-sm font-semibold text-amber-900">Pricing conflict</p>
          <p className="mt-1 text-sm text-amber-800">{pricingWarning}</p>
        </div>
      )}
    </div>
  );
}
