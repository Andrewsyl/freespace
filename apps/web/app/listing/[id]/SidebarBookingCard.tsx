"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingSelector } from "./BookingSelector";
import { OwnerListingNotice } from "./OwnerListingNotice";
import { useAuth } from "../../../components/AuthProvider";
import { calculateListingTotal, formatPriceValue } from "../../../lib/pricing";

const SUPPORT_EMAIL = "support@freespace.ie";

function toDateInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

// Real monthly booking: pick a start date and how many months, see the host's
// monthly price, and reserve. The space is held for the term (the server
// enforces price and the existing overlap check blocks double-booking).
function MonthlyBooking({ listingId, pricePerMonth }: { listingId: string; pricePerMonth: number }) {
  const router = useRouter();
  const [start, setStart] = useState(() => toDateInput(new Date()));
  const [months, setMonths] = useState(1);
  const subtotal = pricePerMonth * months;
  const fee = Math.round(subtotal * 0.08 * 100) / 100;
  const total = subtotal + fee;

  const reserve = () => {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = addMonths(startDate, months);
    const params = new URLSearchParams({
      mode: "monthly",
      date: start,
      startTime: "00:00",
      endDate: toDateInput(endDate),
      endTime: "00:00",
      months: String(months),
    });
    router.push(`/checkout/${listingId}?${params.toString()}` as any);
  };

  return (
    <div className="space-y-4">
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[36px] font-bold leading-none tracking-[-0.015em] text-slate-950">
          <span className="text-brand-500">€</span>{formatPriceValue(pricePerMonth)}
        </span>
        <span className="text-[15px] text-slate-600">/ month</span>
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-slate-700">Start date</label>
        <input
          type="date"
          value={start}
          min={toDateInput(new Date())}
          onChange={(e) => setStart(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-slate-700">Months</label>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMonths((m) => Math.max(1, m - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[18px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            disabled={months <= 1}
            aria-label="Fewer months"
          >
            −
          </button>
          <span className="min-w-[2ch] text-center text-[16px] font-bold tabular-nums text-slate-900">{months}</span>
          <button
            type="button"
            onClick={() => setMonths((m) => Math.min(12, m + 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[18px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            disabled={months >= 12}
            aria-label="More months"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-4 text-[13px]">
        <div className="flex items-center justify-between text-slate-600">
          <span>€{formatPriceValue(pricePerMonth)} × {months} {months === 1 ? "month" : "months"}</span>
          <span className="font-mono">€{formatPriceValue(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span>Service fee</span>
          <span className="font-mono">€{formatPriceValue(fee)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[15px] font-bold text-slate-950">
          <span>Total</span>
          <span className="font-mono">€{total.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={reserve}
        className="flex w-full items-center justify-center rounded-xl bg-brand-600 py-3.5 text-[15px] font-bold text-white transition hover:bg-brand-700"
      >
        Reserve monthly
      </button>
      <p className="text-center text-[12px] text-slate-500">You won&apos;t be charged yet</p>
    </div>
  );
}

// Interim monthly flow: a real enquiry instead of a dead end. Monthly parking
// as a self-serve recurring subscription (what JustPark/SpotHero do) is a
// separate billing build; until then this connects the driver to the host.
function MonthlyRequest({ listingId, listingTitle }: { listingId: string; listingTitle?: string }) {
  const title = listingTitle?.trim() || "this space";
  const handleRequest = () => {
    const url = typeof window !== "undefined" ? window.location.href : `/listing/${listingId}`;
    const subject = `Monthly parking enquiry — ${title}`;
    const body = `Hi FreeSpace team,\n\nI'd like to enquire about monthly parking at ${title}.\n\nListing: ${url}\n\nThanks!`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <div className="py-2">
      <p className="text-[14px] font-semibold text-slate-900">Looking to park here every month?</p>
      <p className="mt-1.5 text-[13px] leading-[1.6] text-slate-600">
        Monthly spaces are arranged directly with the host. Send a request and we&apos;ll connect you, usually within one working day.
      </p>
      <button
        type="button"
        onClick={handleRequest}
        className="mt-4 flex w-full items-center justify-center rounded-xl bg-slate-900 py-3 text-[14px] font-bold text-white transition hover:bg-slate-800"
      >
        Request monthly parking
      </button>
    </div>
  );
}

export function SidebarBookingCard({
  listingId,
  listingTitle,
  hostId,
  initialMonthly = false,
  pricePerMonth,
  pricePerDay,
  pricePerHour,
  rateType,
  unitPrice,
  initialBooking,
}: {
  listingId: string;
  listingTitle?: string;
  hostId?: string;
  initialMonthly?: boolean;
  pricePerMonth?: number | null;
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
  const { user } = useAuth();
  const isOwner = !!hostId && user?.id === hostId;
  const [tab, setTab] = useState<"hourly" | "monthly">(initialMonthly ? "monthly" : "hourly");
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
      dailyCapApplied: summary.dailyCapApplied,
      dailyCapSaving: summary.dailyCapSaving,
    };
  }, [initialBooking?.endDate, initialBooking?.endTime, initialBooking?.startDate, initialBooking?.startTime, pricePerDay, pricePerHour, rateType, unitPrice]);
  const [pricing, setPricing] = useState(defaultPricing);

  if (isOwner) {
    return <OwnerListingNotice listingId={listingId} />;
  }

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
        typeof pricePerMonth === "number" && pricePerMonth > 0 ? (
          <MonthlyBooking listingId={listingId} pricePerMonth={pricePerMonth} />
        ) : (
          <MonthlyRequest listingId={listingId} listingTitle={listingTitle} />
        )
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
            {pricing.dailyCapApplied && (
              <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
                Daily rate applied — saves €{formatPriceValue(pricing.dailyCapSaving)} vs. hourly
              </div>
            )}
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
