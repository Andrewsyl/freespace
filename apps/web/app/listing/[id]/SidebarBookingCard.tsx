"use client";

import { useState } from "react";
import { BookingSelector } from "./BookingSelector";

export function SidebarBookingCard({
  listingId,
  pricePerDay,
  pricePerHour,
  rateType,
  unitPrice,
  rateLabel,
}: {
  listingId: string;
  pricePerDay?: number;
  pricePerHour?: number | null;
  rateType?: "hourly" | "daily" | null;
  unitPrice: number;
  rateLabel: string;
}) {
  const [tab, setTab] = useState<"hourly" | "monthly">("hourly");

  return (
    <div>
      {/* Pill tabs */}
      <div className="mb-5 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        {(["hourly", "monthly"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-9 rounded-full text-[13px] font-semibold transition ${
              tab === t
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "hourly" ? "Hourly / Daily" : "Monthly"}
          </button>
        ))}
      </div>

      {tab === "monthly" ? (
        <p className="py-6 text-center text-[14px] text-slate-400">
          Monthly pricing available on request.
        </p>
      ) : (
        <>
          {/* Price */}
          <div className="mb-1 flex items-baseline gap-1.5">
            <span className="font-mono text-[36px] font-bold leading-none tracking-[-0.015em] text-slate-950">
              <span className="text-brand-500">€</span>{unitPrice}
            </span>
            <span className="text-[15px] text-slate-400">{rateLabel}</span>
          </div>
          <p className="mb-5 text-[13px] text-slate-400">You won&apos;t be charged yet</p>

          {/* Booking selector (picker + modal + CTA) */}
          <BookingSelector
            listingId={listingId}
            pricePerDay={pricePerDay}
            pricePerHour={pricePerHour}
            rateType={rateType}
            unitPrice={unitPrice}
            hidePrice
          />

          {/* Price breakdown */}
          <div className="mt-5 border-t border-slate-100 pt-4 space-y-2">
            <div className="flex items-center justify-between text-[13px] text-slate-500">
              <span>€{unitPrice} × 1 day</span>
              <span className="font-mono">€{unitPrice}.00</span>
            </div>
            <div className="flex items-center justify-between text-[13px] text-slate-500">
              <span>Service fee</span>
              <span className="font-mono">€1.50</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[15px] font-bold text-slate-950">
              <span>Total</span>
              <span className="font-mono">€{(unitPrice + 1.5).toFixed(2)}</span>
            </div>
          </div>

          {/* Guarantee trust block */}
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e6f2ec] text-[#1b8a5a]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-900">Covered by the carpark guarantee</p>
              <p className="mt-0.5 text-[12px] leading-5 text-slate-500">
                If the spot is unavailable on arrival, we&apos;ll find you a replacement or refund you in full.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
