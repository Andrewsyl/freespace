"use client";

import { useEffect, useState } from "react";
import type { HostStepProps } from "./types";

function ClockIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function CalendarIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
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
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-slate-600">{icon}</span>
        <span className="text-sm font-bold text-slate-900">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-base font-bold text-slate-700">€</span>
        <div className="min-w-[100px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <input
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => onChange(sanitize(e.target.value))}
            placeholder="0.00"
            className="w-full bg-transparent text-base font-bold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
    <div className="space-y-4">
      {/* Pricing type card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-300">Pricing type</p>
        <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
          {PRICING_MODES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onUpdate({ pricingMode: key })}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                pricingMode === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rates card */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-brand-300">
          Rates
        </p>
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
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5">
          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">Pricing conflict</p>
            <p className="mt-0.5 text-xs text-amber-800">{pricingWarning}</p>
          </div>
        </div>
      )}

      {/* Tips callout */}
      <div className="rounded-lg bg-brand-50 px-4 py-4 ring-1 ring-brand-100">
        <p className="text-sm font-semibold text-brand-800">Pricing tip</p>
        <p className="mt-1 text-xs leading-relaxed text-brand-700">
          You can update your rates anytime from the host dashboard. Competitive pricing helps fill gaps between longer monthly bookings.
        </p>
      </div>
    </div>
  );
}
