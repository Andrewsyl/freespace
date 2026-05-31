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
      <div className="min-h-screen bg-[#f5f7fb]">
        <SlimNav />
        <div className="px-4 py-10 text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    const currentPath = `/checkout/${params?.id}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    const loginHref = `/login?next=${encodeURIComponent(currentPath)}`;
    const signupHref = `/signup?next=${encodeURIComponent(currentPath)}`;
    return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <SlimNav />
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
          <p className="text-sm text-slate-700">Sign in to start a booking.</p>
          <div className="flex gap-2 text-sm">
            <Link href={loginHref as any} className="btn-primary">
              Sign in
            </Link>
            <Link href={signupHref as any} className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <SlimNav />
        <div className="px-4 py-10 text-sm text-slate-600">Loading listing…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <SlimNav />
      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-28 pt-8 sm:px-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold tracking-wide text-brand-600">Booking confirmation</p>
          <h1 className="text-3xl tracking-tight font-semibold text-slate-900">{listing.title}</h1>
          <p className="text-sm text-slate-600">{listing.address}</p>
        </header>

        <div className="rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Parking location</h2>
          <p className="mt-2 text-sm text-slate-600">Review the space details before confirming.</p>
          <div className="mt-4 rounded-lg border border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{listing.title}</p>
            <p className="text-sm text-slate-600">{listing.address}</p>
          </div>
        </div>

        <form id="checkout-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Session details</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-wide text-slate-600">
                {durationHours} hrs
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SearchDateTimePicker
                label="From"
                value={startAt}
                portalPopup
                onChange={(next) => {
                  setStartAt(next);
                  if (next >= endAt) {
                    setEndAt(new Date(next.getTime() + 2 * 60 * 60 * 1000));
                  }
                }}
              />
              <SearchDateTimePicker
                label="Until"
                value={endAt}
                portalPopup
                onChange={(next) => {
                  if (next > startAt) {
                    setEndAt(next);
                  }
                }}
              />
            </div>
            <div className="mt-5 rounded-lg border border-slate-200">
              {[
                { label: "START", value: startAt.toLocaleString() },
                { label: "END", value: endAt.toLocaleString() },
                { label: "DURATION", value: `${durationHours} hours` },
              ].map((row, index) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between px-4 py-3 text-sm ${index !== 0 ? "border-t border-slate-200" : ""}`}
                >
                  <span className="text-xs font-semibold tracking-wide text-slate-400">{row.label}</span>
                  <span className="text-sm font-semibold text-slate-900">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Price breakdown</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-slate-400">HOST RATE</span>
                <span className="text-sm font-semibold text-slate-900">{formatListingPriceLine(listing)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-slate-400">BILLING PERIOD</span>
                <span className="text-sm font-semibold text-slate-900">
                  {pricing?.billingCount ?? 0} {pricing?.billingUnit ?? "day"}{pricing?.billingCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-slate-400">PARKING FEE</span>
                <span className="text-sm font-semibold text-slate-900">€{parkingFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-slate-400">PLATFORM FEE</span>
                <span className="text-sm font-semibold text-slate-900">{platformFeeLabel}</span>
              </div>
              <div className="rounded-lg bg-brand-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wide text-brand-600">TOTAL DUE TODAY</span>
                  <span className="text-lg font-semibold text-brand-700">€{totalPrice.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs leading-5 text-slate-500">No hidden fees will be added after checkout.</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Cancellation policy</h2>
            <p className="mt-3 text-sm text-slate-600">
              Cancel up to 2 hours before the start time for a full refund. Late cancellations may incur a fee.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Payment method</h2>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("google")}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                  paymentMethod === "google"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>Google Pay</span>
                <span className="text-xs font-semibold tracking-wide">Fast checkout</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                  paymentMethod === "card"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>Add card</span>
                <span className="text-xs font-semibold tracking-wide text-slate-500">Stripe</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}
          {status === "success" && checkoutUrl && (
            <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
              Redirecting to Stripe… If not redirected,{" "}
              <a className="underline" href={checkoutUrl}>
                click here
              </a>
              .
            </div>
          )}
        </form>

        <p className="text-xs text-slate-500">
          FreeSpace is the booking marketplace. Hosts manage the physical space and site rules. By booking, you agree to the{" "}
          <Link href="/legal/parking-terms-liability" className="font-semibold text-brand-700 hover:text-brand-800">
            parking terms and liability policy
          </Link>
          .
        </p>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 border-t border-slate-100 bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[22px] font-bold tracking-tight text-slate-900">€{totalPrice.toFixed(2)}</p>
            <p className="text-[12px] text-slate-400">{durationHours} hour{durationHours !== 1 ? "s" : ""} total</p>
          </div>
          <button
            type="submit"
            form="checkout-form"
            className="flex h-12 min-w-[160px] items-center justify-center rounded-xl bg-brand-500 px-6 text-[15px] font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={status === "loading"}
          >
            {status === "loading"
              ? "Processing…"
              : paymentMethod === "google"
                ? "Buy with G Pay"
                : "Pay & reserve"}
          </button>
        </div>
      </div>
    </div>
  );
}
