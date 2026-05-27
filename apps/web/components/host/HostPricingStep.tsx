"use client";

import { useEffect, useMemo, useState } from "react";
import type { HostStepProps } from "./types";

const SUGGESTED_PRICES = [5, 8, 10, 15, 20, 25];
const MIN_PRICE = 1;
const MAX_PRICE = 999;
const DEFAULT_DAILY = 12;
const DEFAULT_MONTHLY = 100;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number) {
  return roundMoney(value).toFixed(2);
}

function parseNumber(raw: string) {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function HostPricingStep({ data, onUpdate }: HostStepProps) {
  const dailyPrice = typeof data.pricePerDay === "number" ? data.pricePerDay : DEFAULT_DAILY;
  const monthlyEnabled = typeof data.pricePerMonth === "number" && data.pricePerMonth > 0;
  const suggestedMonthly = useMemo(() => DEFAULT_MONTHLY, []);
  const [dailyInput, setDailyInput] = useState(
    typeof data.pricePerDay === "number" ? String(data.pricePerDay) : String(DEFAULT_DAILY)
  );
  const [monthlyInput, setMonthlyInput] = useState(
    typeof data.pricePerMonth === "number" ? String(data.pricePerMonth) : ""
  );

  useEffect(() => {
    const next = typeof data.pricePerDay === "number" ? String(data.pricePerDay) : String(DEFAULT_DAILY);
    setDailyInput((prev) => (prev === next ? prev : next));
  }, [data.pricePerDay]);

  useEffect(() => {
    const next = typeof data.pricePerMonth === "number" ? String(data.pricePerMonth) : "";
    setMonthlyInput((prev) => (prev === next ? prev : next));
  }, [data.pricePerMonth]);

  const adjustDailyPrice = (delta: number) => {
    const next = Math.min(MAX_PRICE, Math.max(MIN_PRICE, dailyPrice + delta));
    onUpdate({ pricePerDay: next });
  };

  const handleDailyChange = (raw: string) => {
    setDailyInput(raw);
    const parsed = parseNumber(raw);
    if (!raw) {
      onUpdate({ pricePerDay: undefined });
    } else if (parsed !== null && parsed >= 0) {
      onUpdate({ pricePerDay: Math.min(MAX_PRICE, parsed) });
    }
  };

  const handleMonthlyChange = (raw: string) => {
    setMonthlyInput(raw);
    const parsed = parseNumber(raw);
    if (!raw) {
      onUpdate({ pricePerMonth: undefined });
    } else if (parsed !== null && parsed >= 0) {
      onUpdate({ pricePerMonth: Math.min(MAX_PRICE * 31, parsed) });
    }
  };

  const enableMonthly = () => {
    const nextMonthly = data.pricePerMonth ?? suggestedMonthly ?? DEFAULT_MONTHLY;
    setMonthlyInput(String(nextMonthly));
    onUpdate({
      pricePerMonth: nextMonthly,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Daily price</p>
        <div className="flex items-center justify-center gap-6 py-4">
          <button
            type="button"
            onClick={() => adjustDailyPrice(-1)}
            disabled={dailyPrice <= MIN_PRICE}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            −
          </button>

          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-400">€</span>
            <input
              type="number"
              min={MIN_PRICE}
              max={MAX_PRICE}
              step="0.01"
              value={dailyInput}
              onChange={(e) => handleDailyChange(e.target.value)}
              placeholder="0"
              className="w-28 bg-transparent text-center text-5xl font-bold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="self-end pb-1 text-base font-semibold text-slate-500">/ day</span>
          </div>

          <button
            type="button"
            onClick={() => adjustDailyPrice(1)}
            disabled={dailyPrice >= MAX_PRICE}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            +
          </button>
        </div>

        {dailyPrice > 0 && (
          <p className="text-center text-xs text-slate-400">
            You keep <span className="font-semibold text-slate-600">€{(dailyPrice * 0.9).toFixed(2)}</span> after the 10% platform fee
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested daily prices</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PRICES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onUpdate({ pricePerDay: p })}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                dailyPrice === p
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              €{p}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Offer a monthly rate</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Add a separate commuter-style monthly price for hosts who want longer-term bookings. Leave it off if this space is short-stay only.
            </p>
          </div>
          {monthlyEnabled ? (
            <button
              type="button"
              onClick={() => onUpdate({ pricePerMonth: undefined })}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={enableMonthly}
              className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              Add monthly
            </button>
          )}
        </div>

        {monthlyEnabled ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly price</span>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-lg font-semibold text-slate-500">€</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_PRICE * 31}
                  step="0.01"
                  value={monthlyInput}
                  onChange={(e) => handleMonthlyChange(e.target.value)}
                  placeholder={suggestedMonthly ? formatMoney(suggestedMonthly) : "100.00"}
                  className="w-full bg-transparent text-xl font-semibold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-sm font-semibold text-slate-500">/ month</span>
              </div>
            </label>
            {suggestedMonthly ? (
              <p className="text-xs text-slate-500">
                Suggested starting point: <span className="font-semibold text-slate-700">€{formatMoney(suggestedMonthly)}</span>.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Monthly pricing is optional. Drivers will only see a monthly option when you set a monthly rate.
      </p>
    </div>
  );
}
