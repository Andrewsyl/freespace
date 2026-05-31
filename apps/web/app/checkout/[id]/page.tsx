"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBooking, getListing, type ListingDetail } from "../../../lib/api";
import { calculateListingTotal, formatListingPriceLine } from "../../../lib/pricing";
import { useAuth } from "../../../components/AuthProvider";
import { SlimNav } from "../../../components/SlimNav";
import { SearchDateTimePicker } from "../../../components/SearchForm";

export default function CheckoutPage() {
  const { user, token, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "google">("card");

  const defaultStart = useMemo(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
    const date = searchParams?.get("date");
    const startTime = searchParams?.get("startTime");
    if (date && startTime) {
      const parsed = new Date(`${date}T${startTime}:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return now;
  }, [searchParams]);
  const defaultEnd = useMemo(() => {
    const endDate = searchParams?.get("endDate") ?? searchParams?.get("date");
    const endTime = searchParams?.get("endTime");
    if (endDate && endTime) {
      const parsed = new Date(`${endDate}T${endTime}:00`);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > defaultStart.getTime()) {
        return parsed;
      }
    }
    return new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000);
  }, [defaultStart, searchParams]);
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(defaultEnd);

  const pricing = useMemo(
    () => (listing ? calculateListingTotal(listing, startAt, endAt) : null),
    [endAt, listing, startAt]
  );
  const durationHours = useMemo(() => {
    const diff = endAt.getTime() - startAt.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60)));
  }, [endAt, startAt]);
  const totalPrice = pricing?.total ?? 0;
  const parkingFee = totalPrice;
  const platformFeeLabel = "Included";
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const toTimeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  useEffect(() => {
    const id = params?.id;
    if (!id) return;
    getListing(id)
      .then(setListing)
      .catch(() => setError("Listing not found"));
  }, [params?.id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || !listing) {
      setError("Please sign in to book.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const from = `${toDateStr(startAt)}T${toTimeStr(startAt)}:00Z`;
      const to = `${toDateStr(endAt)}T${toTimeStr(endAt)}:00Z`;
      const amountCents = Math.max(1, Math.round(totalPrice * 100));
      const res = await createBooking(
        {
          listingId: listing.id,
          from,
          to,
          amountCents,
          currency: "eur",
          platformFeePercent: 0.1,
        },
        token
      );
      setCheckoutUrl(res.checkoutUrl);
      setStatus("success");
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not start booking");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    const currentPath = `/checkout/${params?.id}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    const loginHref = `/login?next=${encodeURIComponent(currentPath)}`;
    const signupHref = `/signup?next=${encodeURIComponent(currentPath)}`;
    return (
      <div className="min-h-screen bg-white">
        <SlimNav />
        <div className="px-5 py-10">
          <p className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Sign in to book</p>
          <p className="mt-1 text-[14px] text-slate-500">You need an account to complete this booking.</p>
          <div className="mt-5 flex flex-col gap-3">
            <Link href={loginHref as any} className="flex items-center justify-center rounded-2xl bg-brand-500 py-3.5 text-[15px] font-bold text-white active:bg-brand-600">
              Sign in
            </Link>
            <Link href={signupHref as any} className="flex items-center justify-center rounded-2xl border border-slate-200 py-3.5 text-[15px] font-semibold text-slate-700 active:bg-slate-50">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SlimNav />

      {/* ── Page header ── */}
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Confirm booking</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">{listing.title}</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">{listing.address}</p>
      </div>

      <form id="checkout-form" onSubmit={handleSubmit}>

        {/* ── Session details ── */}
        <section className="border-b border-slate-200 px-5 py-6">
          <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Your session</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SearchDateTimePicker
              label="From"
              value={startAt}
              portalPopup
              onChange={(next) => {
                setStartAt(next);
                if (next >= endAt) setEndAt(new Date(next.getTime() + 2 * 60 * 60 * 1000));
              }}
            />
            <SearchDateTimePicker
              label="Until"
              value={endAt}
              portalPopup
              onChange={(next) => { if (next > startAt) setEndAt(next); }}
            />
          </div>
          <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
            {[
              { label: "Arrives", value: startAt.toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" }) },
              { label: "Departs", value: endAt.toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" }) },
              { label: "Duration", value: `${durationHours} hour${durationHours !== 1 ? "s" : ""}` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] text-slate-500">{row.label}</span>
                <span className="text-[13px] font-semibold text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Price breakdown ── */}
        <section className="border-b border-slate-200 px-5 py-6">
          <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Price breakdown</h2>
          <div className="mt-4 divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-[13px] text-slate-500">Rate</span>
              <span className="text-[13px] font-semibold text-slate-900">{formatListingPriceLine(listing)}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-[13px] text-slate-500">Billing period</span>
              <span className="text-[13px] font-semibold text-slate-900">
                {pricing?.billingCount ?? 0} {pricing?.billingUnit ?? "day"}{pricing?.billingCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-[13px] text-slate-500">Platform fee</span>
              <span className="text-[13px] font-semibold text-slate-900">{platformFeeLabel}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-[14px] font-bold text-slate-900">Total</span>
              <span className="text-[18px] font-extrabold tracking-tight text-brand-600">€{totalPrice.toFixed(2)}</span>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">No hidden fees will be added at checkout.</p>
        </section>

        {/* ── Payment method ── */}
        <section className="border-b border-slate-200 px-5 py-6">
          <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Payment method</h2>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => setPaymentMethod("google")}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-[14px] font-semibold transition active:scale-[0.99] ${
                paymentMethod === "google"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-900 active:bg-slate-50"
              }`}
            >
              <span>Google Pay</span>
              <span className={`text-[11px] font-semibold ${paymentMethod === "google" ? "text-white/60" : "text-slate-400"}`}>Fast checkout</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("card")}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-[14px] font-semibold transition active:scale-[0.99] ${
                paymentMethod === "card"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-900 active:bg-slate-50"
              }`}
            >
              <span>Card</span>
              <span className={`text-[11px] font-semibold ${paymentMethod === "card" ? "text-brand-400" : "text-slate-400"}`}>Stripe</span>
            </button>
          </div>
        </section>

        {/* ── Cancellation policy ── */}
        <section className="border-b border-slate-200 px-5 py-6">
          <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Cancellation policy</h2>
          <p className="mt-3 text-[14px] leading-6 text-slate-600">
            Cancel up to 2 hours before the start time for a full refund. Late cancellations may incur a fee.
          </p>
        </section>

        {/* ── Legal ── */}
        <div className="px-5 py-5">
          <p className="text-[12px] leading-5 text-slate-400">
            By booking you agree to the{" "}
            <Link href="/legal/parking-terms-liability" className="font-semibold text-slate-600 underline underline-offset-2">
              parking terms and liability policy
            </Link>
            .
          </p>
        </div>

        {error && (
          <div className="mx-5 mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>
        )}
        {status === "success" && checkoutUrl && (
          <div className="mx-5 mb-4 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
            Redirecting to Stripe…{" "}
            <a className="font-semibold underline underline-offset-2" href={checkoutUrl}>Click here</a> if nothing happens.
          </div>
        )}

      </form>

      {/* ── Sticky footer ── */}
      <div
        className="fixed inset-x-0 bottom-0 bg-white px-4 shadow-[0_-4px_20px_rgba(15,23,42,0.10)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)", paddingTop: "12px" }}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-[11px] font-semibold text-slate-400">{durationHours} hour{durationHours !== 1 ? "s" : ""}</p>
            <p className="text-[20px] font-extrabold tracking-tight text-slate-900">€{totalPrice.toFixed(2)}</p>
          </div>
          <button
            type="submit"
            form="checkout-form"
            className="flex flex-1 items-center justify-center rounded-2xl bg-brand-500 py-3.5 text-[15px] font-bold text-white shadow-sm transition active:bg-brand-600 disabled:opacity-50"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Processing…" : paymentMethod === "google" ? "Buy with G Pay" : "Pay & reserve"}
          </button>
        </div>
      </div>
    </div>
  );
}
