"use client";

import type { HostStepProps } from "./types";

const SUGGESTED_PRICES = [5, 8, 10, 15, 20, 25];
const MIN_PRICE = 1;
const MAX_PRICE = 999;

export function HostPricingStep({ data, onUpdate }: HostStepProps) {
  const price = typeof data.pricePerDay === "number" ? data.pricePerDay : 0;

  const adjustPrice = (delta: number) => {
    const next = Math.min(MAX_PRICE, Math.max(MIN_PRICE, price + delta));
    onUpdate({ pricePerDay: next });
  };

  const handleInputChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (!raw) {
      onUpdate({ pricePerDay: undefined });
    } else if (!Number.isNaN(parsed) && parsed >= 0) {
      onUpdate({ pricePerDay: Math.min(MAX_PRICE, parsed) });
    }
  };

  return (
    <div className="space-y-6">
      {/* Large price stepper */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Daily price</p>
        <div className="flex items-center justify-center gap-6 py-4">
          <button
            type="button"
            onClick={() => adjustPrice(-1)}
            disabled={price <= MIN_PRICE}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            −
          </button>

          {/* Price display / direct input */}
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-400">€</span>
            <input
              type="number"
              min={MIN_PRICE}
              max={MAX_PRICE}
              value={price > 0 ? price : ""}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="0"
              className="w-24 bg-transparent text-center text-5xl font-bold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="self-end pb-1 text-base font-semibold text-slate-500">/ day</span>
          </div>

          <button
            type="button"
            onClick={() => adjustPrice(1)}
            disabled={price >= MAX_PRICE}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            +
          </button>
        </div>

        {price > 0 && (
          <p className="text-center text-xs text-slate-400">
            You keep <span className="font-semibold text-slate-600">€{((price * 0.9)).toFixed(2)}</span> after the 10% platform fee
          </p>
        )}
      </div>

      {/* Suggested prices */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested prices</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PRICES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onUpdate({ pricePerDay: p })}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                price === p
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              €{p}
            </button>
          ))}
        </div>
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
        💡 You can update your price at any time from your host dashboard.
      </p>
    </div>
  );
}
