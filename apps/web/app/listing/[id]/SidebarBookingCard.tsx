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
      {/* Rate type tabs */}
      <div className="flex overflow-hidden rounded-lg border border-slate-200 text-[13px] font-semibold">
        <button
          type="button"
          onClick={() => setTab("monthly")}
          className={`flex-1 py-2.5 text-center transition ${
            tab === "monthly"
              ? "bg-slate-950 text-white"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setTab("hourly")}
          className={`flex-1 py-2.5 text-center transition ${
            tab === "hourly"
              ? "bg-slate-950 text-white"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          Hourly / Daily
        </button>
      </div>

      {tab === "monthly" ? (
        <div className="py-10 text-center text-[14px] text-slate-400">
          Monthly pricing available on request.
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-[30px] font-bold leading-none tracking-[-0.05em] text-slate-950">
              €{unitPrice}
            </span>
            <span className="text-[14px] text-slate-400">{rateLabel}</span>
          </div>
          <div className="mt-4">
            <BookingSelector
              listingId={listingId}
              pricePerDay={pricePerDay}
              pricePerHour={pricePerHour}
              rateType={rateType}
              hidePrice
            />
          </div>
        </>
      )}

      {/* Book with confidence */}
      <div className="mt-5 rounded-xl border border-emerald-200 bg-[#f0fdf6] px-4 py-4">
        <p className="text-[13px] font-semibold text-emerald-800">Book with confidence</p>
        <div className="mt-3 space-y-2 text-[13px] text-emerald-700">
          {[
            "Confirmation is immediate",
            "Trusted by thousands of drivers",
            "Free cancellation available",
            "Arrival instructions sent after booking",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
