"use client";

import { useMemo, useState } from "react";
import { BookingSelector } from "./BookingSelector";
import { calculateListingTotal, formatPriceValue } from "../../../lib/pricing";

export function SidebarBookingCard({
  listingId,
  pricePerDay,
  pricePerHour,
  rateType,
  unitPrice,
  initialBooking,
}: {
  listingId: string;
  pricePerDay?: number;
  pricePerHour?: number | null;
  rateType?: "hourly" | "daily" | null;
  unitPrice: number;
  initialBooking?: {
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
  };
}) {
  const [tab, setTab] = useState<"hourly" | "monthly">("hourly");
  const defaultPricing = useMemo(() => {
    const start =
      initialBooking?.startDate && initialBooking?.startTime
        ? new Date(`${initialBooking.startDate}T${initialBooking.startTime}:00`)
        : new Date();
    const rawEnd =
      initialBooking?.endDate && initialBooking?.endTime
        ? new Date(`${initialBooking.endDate}T${initialBooking.endTime}:00`)
        : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const end =
      rawEnd.getTime() <= start.getTime()
        ? new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000)
        : rawEnd;
    const summary = calculateListingTotal(
      {
        pricePerDay: pricePerDay ?? unitPrice,
        pricePerHour: pricePerHour ?? null,
        rateType: rateType ?? "daily",
      },
      start,
      end
    );
    return {
      subtotal: summary.total,
      total: summary.total + 1.5,
      durationLabel: summary.durationLabel,
      billingLabel: summary.durationLabel,
    };
  }, [initialBooking?.endDate, initialBooking?.endTime, initialBooking?.startDate, initialBooking?.startTime, pricePerDay, pricePerHour, rateType, unitPrice]);
  const [pricing, setPricing] = useState(defaultPricing);

  return (
    <div>
      {/* Header */}
      <h3 className="mb-4 text-[18px] font-bold tracking-[-0.02em] text-slate-950">
        Reserve your parking space
      </h3>

      {/* Tab bar — underline style */}
      <div className="mb-5 flex border-b border-slate-200">
        {(["hourly", "monthly"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 pb-2.5 text-[13px] font-semibold transition ${
              tab === t
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t === "hourly" ? "Hourly / Daily" : "Monthly"}
          </button>
        ))}
      </div>

      {tab === "monthly" ? (
        <p className="py-6 text-center text-[14px] text-slate-600">
          Monthly pricing available on request.
        </p>
      ) : (
        <>
          {/* Price */}
          <div className="mb-1 flex items-baseline gap-1.5">
            <span className="font-mono text-[36px] font-bold leading-none tracking-[-0.015em] text-slate-950">
              <span className="text-brand-500">€</span>{formatPriceValue(pricing.subtotal)}
            </span>
            <span className="text-[15px] text-slate-600">for {pricing.durationLabel}</span>
          </div>
          <p className="mb-5 text-[13px] text-slate-600">You won&apos;t be charged yet</p>

          {/* Booking selector (picker + modal + CTA) */}
          <BookingSelector
            listingId={listingId}
            pricePerDay={pricePerDay}
            pricePerHour={pricePerHour}
            rateType={rateType}
            hidePrice
            onPricingChange={setPricing}
            initialValues={initialBooking}
          />

          {/* Price breakdown */}
          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-[13px] text-slate-600">
              <span>{pricing.billingLabel}</span>
              <span className="font-mono">€{formatPriceValue(pricing.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px] text-slate-600">
              <span>Service fee</span>
              <span className="font-mono">€1.50</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[15px] font-bold text-slate-950">
              <span>Total</span>
              <span className="font-mono">€{pricing.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Book with confidence */}
          <div className="mt-4 rounded-lg border border-brand-500/30 bg-brand-500/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-brand-600">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <p className="text-[13px] font-bold text-brand-700">Book with confidence</p>
            </div>
            {([
              "Instant booking confirmation",
              "Secure, encrypted payment",
              "No hidden fees",
              "Cancel before your booking starts",
            ] as const).map((item) => (
              <div key={item} className="mb-1.5 flex items-center gap-2 last:mb-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brand-500">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
                <span className="text-[12px] text-slate-600">{item}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
