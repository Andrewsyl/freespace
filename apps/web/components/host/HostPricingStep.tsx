"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { HostStepProps } from "./types";
import { SectionIntro, RadioTile } from "./_ui";

const PRICING_MODES = [
  {
    key:         "hourly_daily",
    label:       "Hourly & daily",
    description: "Drivers book by the hour or day — ideal for casual parking near busy areas.",
  },
  {
    key:         "monthly",
    label:       "Monthly only",
    description: "One driver pays a recurring monthly rate — reliable, predictable income.",
  },
  {
    key:         "both",
    label:       "All options",
    description: "Accept hourly, daily, and monthly bookings to maximise your earnings.",
  },
] as const;

function sanitize(value: string) {
  const n = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, ...rest] = n.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

function parseMoney(v: string) {
  const n = parseFloat(v);
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function RateField({
  label,
  suffix,
  value,
  onChange,
  hint,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[14px] font-semibold text-slate-800">{label}</label>
      <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-white transition-colors focus-within:border-brand-600">
        <span className="pl-4 text-[20px] font-bold text-slate-400">€</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          placeholder="0.00"
          className="flex-1 bg-transparent py-3.5 pl-2 pr-1 text-[24px] font-extrabold tracking-tight text-slate-900 outline-none placeholder:text-slate-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="pr-4 text-[14px] font-medium text-slate-400">{suffix}</span>
      </div>
      {hint && <p className="mt-1.5 text-[12px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function HostPricingStep({ data, onUpdate }: HostStepProps) {
  const pricingMode = data.pricingMode ?? "both";

  const [hourly,  setHourly]  = useState(String(data.pricePerHour  ?? ""));
  const [daily,   setDaily]   = useState(String(data.pricePerDay   ?? ""));
  const [monthly, setMonthly] = useState(String(data.pricePerMonth ?? ""));

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
  const monthlyVal = parseMoney(monthly) ?? 0;

  // Honest projection from the host's own rate — not a market claim.
  const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
  const estDaily = dailyVal > 0 ? dailyVal : hourlyVal > 0 ? hourlyVal * 8 : 0;
  let estLo = 0;
  let estHi = 0;
  if (pricingMode === "monthly") {
    estLo = estHi = monthlyVal;
  } else if (estDaily > 0) {
    estLo = round5(estDaily * 15);
    estHi = round5(estDaily * 24);
  }
  const showEst = estLo > 0;

  const warning =
    hourlyVal > 0 && dailyVal > 0 && dailyVal > hourlyVal * 24
      ? `Your daily rate (€${dailyVal.toFixed(2)}) is higher than 24× your hourly rate. Drivers may find it cheaper to book hourly.`
      : null;

  return (
    <div className="space-y-10">

      {/* Pricing model */}
      <div>
        <SectionIntro label="Booking type">Choose how drivers can book your space.</SectionIntro>
        <div className="space-y-2.5">
          {PRICING_MODES.map(({ key, label, description }) => (
            <RadioTile
              key={key}
              active={pricingMode === key}
              onClick={() => onUpdate({ pricingMode: key })}
              title={label}
              description={description}
            />
          ))}
        </div>
      </div>

      {/* Rate inputs */}
      <div>
        <SectionIntro label="Your rates">You can update these any time from your dashboard.</SectionIntro>
        <div className="space-y-5">
          {(pricingMode === "hourly_daily" || pricingMode === "both") && (
            <RateField
              label="Hourly rate"
              suffix="per hour"
              value={hourly}
              onChange={setHourly}
              hint="Most casual parkers"
            />
          )}
          {(pricingMode === "hourly_daily" || pricingMode === "both") && (
            <RateField
              label="Daily rate"
              suffix="per day"
              value={daily}
              onChange={setDaily}
              hint="Capped at daily when booking multiple hours"
            />
          )}
          {(pricingMode === "monthly" || pricingMode === "both") && (
            <RateField
              label="Monthly rate"
              suffix="per month"
              value={monthly}
              onChange={setMonthly}
              hint="Rolling subscription for commuters"
            />
          )}
        </div>
      </div>

      {/* Earning potential — the motivation moment */}
      {showEst && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Your earning potential</p>
          <p className="mt-2 text-[32px] font-extrabold tracking-tight text-slate-900">
            {estLo === estHi ? `€${estLo}` : `€${estLo}–€${estHi}`}
            <span className="ml-1 text-[15px] font-semibold text-slate-500">/ month</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-brand-800">
            {pricingMode === "monthly"
              ? "Guaranteed from one recurring monthly booking — a steady, predictable income."
              : "Estimated from your daily rate at typical occupancy (15–24 booked days a month). Actual earnings depend on local demand."}
          </p>
        </div>
      )}

      {/* Pricing mismatch warning */}
      {warning && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-500" strokeWidth={2} />
          <p className="text-[13px] leading-relaxed text-amber-800">{warning}</p>
        </div>
      )}
    </div>
  );
}
