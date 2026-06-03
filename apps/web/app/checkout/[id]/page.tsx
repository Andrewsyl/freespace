"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBooking, getListing, type ListingDetail } from "../../../lib/api";
import { calculateListingTotal, formatListingPriceLine } from "../../../lib/pricing";
import { useAuth } from "../../../components/AuthProvider";
import { SlimNav } from "../../../components/SlimNav";
import { SearchDateTimePicker } from "../../../components/SearchForm";
import { Lock, Star, ArrowRight, CheckCircle, ChevronDown } from "lucide-react";

export default function CheckoutPage() {
  const { user, token, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState(() => user?.vehiclePlate ?? "");
  const [showTimePicker, setShowTimePicker] = useState(false);

  const defaultStart = useMemo(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
    const date = searchParams?.get("date");
    const startTime = searchParams?.get("startTime");
    if (date && startTime) {
      const parsed = new Date(`${date}T${startTime}:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return now;
  }, [searchParams]);

  const defaultEnd = useMemo(() => {
    const endDate = searchParams?.get("endDate") ?? searchParams?.get("date");
    const endTime = searchParams?.get("endTime");
    if (endDate && endTime) {
      const parsed = new Date(`${endDate}T${endTime}:00`);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > defaultStart.getTime()) return parsed;
    }
    return new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000);
  }, [defaultStart, searchParams]);

  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(defaultEnd);

  const pricing = useMemo(
    () => (listing ? calculateListingTotal(listing, startAt, endAt) : null),
    [endAt, listing, startAt]
  );

  const extensionPricing = useMemo(() => {
    if (!listing) return [];
    return [1, 2, 3].map((hrs) => {
      const extEnd = new Date(endAt.getTime() + hrs * 3600000);
      const extTotal = calculateListingTotal(listing, startAt, extEnd).total;
      const current = pricing?.total ?? 0;
      return { hrs, extra: extTotal - current };
    });
  }, [listing, startAt, endAt, pricing]);

  const totalPrice = pricing?.total ?? 0;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const toTimeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-IE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  const formatDateShort = (d: Date) => {
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();
    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
  };

  useEffect(() => {
    const id = params?.id;
    if (!id) return;
    getListing(id).then(setListing).catch(() => setError("Listing not found"));
  }, [params?.id]);

  useEffect(() => {
    if (user?.vehiclePlate) setVehiclePlate(user.vehiclePlate);
  }, [user?.vehiclePlate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || !listing) { setError("Please sign in to book."); return; }
    setStatus("loading");
    setError(null);
    try {
      const from = `${toDateStr(startAt)}T${toTimeStr(startAt)}:00Z`;
      const to = `${toDateStr(endAt)}T${toTimeStr(endAt)}:00Z`;
      const amountCents = Math.max(1, Math.round(totalPrice * 100));
      const res = await createBooking(
        { listingId: listing.id, from, to, amountCents, currency: "eur", platformFeePercent: 0.1, vehiclePlate: vehiclePlate.trim() || undefined },
        token
      );
      setCheckoutUrl(res.checkoutUrl);
      setStatus("success");
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not start booking");
    }
  };

  // ── Loading / auth gates ──────────────────────────────────────────────────────

  if (loading || !listing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    const currentPath = `/checkout/${params?.id}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    return (
      <div className="min-h-screen bg-slate-50">
        <CheckoutNav />
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <h1 className="text-[22px] font-bold text-slate-900">Sign in to continue</h1>
          <p className="mt-2 text-[14px] text-slate-500">You need an account to complete this booking.</p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href={`/login?next=${encodeURIComponent(currentPath)}` as any} className="flex items-center justify-center rounded-xl bg-brand-500 py-3.5 text-[15px] font-bold text-white hover:bg-brand-600">
              Sign in
            </Link>
            <Link href={`/signup?next=${encodeURIComponent(currentPath)}` as any} className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-3.5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const nextPath = `/checkout/${params?.id}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
  const hasRating = typeof listing.rating === "number" && listing.rating > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <CheckoutNav />

      <form id="checkout-form" onSubmit={handleSubmit}>
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex items-start gap-8">

            {/* ── Left column ── */}
            <div className="min-w-0 flex-1 space-y-4">

              {/* Contact info */}
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold text-slate-900">Contact Info</h2>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {user.name ?? user.email}
                    </p>
                    {user.name && (
                      <p className="text-[13px] text-slate-400">{user.email}</p>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/profile?next=${encodeURIComponent(nextPath)}` as any}
                    className="text-[13px] font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                  >
                    Change
                  </Link>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-500">
                  You'll receive booking confirmation and updates by email.
                </div>
              </Card>

              {/* Payment method */}
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-bold text-slate-900">Payment Method</h2>
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <div className="flex h-8 w-12 items-center justify-center rounded border border-slate-200 bg-white text-[11px] font-bold text-slate-700 shadow-sm">
                    Card
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold text-slate-800">Credit or Debit Card</p>
                    <p className="text-[12px] text-slate-400">Secured by Stripe</p>
                  </div>
                  <Lock className="ml-auto h-4 w-4 text-slate-300" />
                </div>
                <p className="mt-2 text-[11.5px] text-slate-400">
                  Visa, Mastercard, Amex and more accepted.
                </p>
              </Card>

              {/* Vehicle */}
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-bold text-slate-900">Vehicle</h2>
                  <Link
                    href={`/dashboard/vehicle?next=${encodeURIComponent(nextPath)}` as any}
                    className="text-[13px] font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                  >
                    {vehiclePlate ? "Change" : "Add"}
                  </Link>
                </div>
                {vehiclePlate ? (
                  <div className="mt-3 flex overflow-hidden rounded-lg border-2 border-slate-900 shadow-sm">
                    <div className="w-9 shrink-0 bg-[#003399]" />
                    <div className="flex flex-1 items-center bg-[#FAFAF8] px-4 py-3">
                      <span className="text-[20px] font-bold uppercase tracking-[0.1em] text-slate-900">
                        {vehiclePlate}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="mb-3 text-[13px] text-slate-500">
                      Add it now or later — we'll remind you before you park.
                    </p>
                    <Link
                      href={`/dashboard/vehicle?next=${encodeURIComponent(nextPath)}` as any}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Add Vehicle Now
                    </Link>
                  </div>
                )}
              </Card>

              {/* Cancellation policy */}
              <Card>
                <h2 className="text-[16px] font-bold text-slate-900">Cancellation Policy</h2>
                <p className="mt-2 text-[13.5px] leading-6 text-slate-600">
                  Cancel up to 2 hours before the start time for a full refund. Late cancellations may incur a fee.
                </p>
              </Card>

              {/* Error / success */}
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                  {error}
                </div>
              )}
              {status === "success" && checkoutUrl && (
                <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
                  Redirecting to Stripe…{" "}
                  <a className="font-semibold underline underline-offset-2" href={checkoutUrl}>Click here</a> if nothing happens.
                </div>
              )}

              {/* Pay button */}
              <button
                type="submit"
                form="checkout-form"
                disabled={status === "loading"}
                className="flex w-full items-center justify-center rounded-xl bg-brand-500 py-4 text-[15px] font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.99] disabled:opacity-50"
              >
                {status === "loading" ? "Processing…" : `Pay €${totalPrice.toFixed(2)} & Reserve`}
              </button>

              <p className="text-center text-[12px] text-slate-400">
                By purchasing, you agree to our{" "}
                <Link href="/legal/parking-terms-liability" className="font-semibold text-slate-500 underline underline-offset-2">
                  Terms & Conditions
                </Link>{" "}
                and{" "}
                <Link href="/legal/privacy" className="font-semibold text-slate-500 underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            {/* ── Right column — sticky order summary ── */}
            <div className="w-[400px] shrink-0">
              <div className="sticky top-8 rounded-2xl border border-slate-200 bg-white shadow-sm">

                {/* Listing header */}
                <div className="border-b border-slate-100 px-6 py-5">
                  <h2 className="text-[17px] font-bold leading-snug text-slate-900">{listing.title}</h2>
                  {hasRating && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-600">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold">{listing.rating!.toFixed(1)}</span>
                      {(listing.ratingCount ?? 0) > 0 && (
                        <span className="text-slate-400">({listing.ratingCount})</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Reservation period */}
                <div className="border-b border-slate-100 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                      Reservation Period
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTimePicker((s) => !s)}
                      className="text-[12.5px] font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                    >
                      Change
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[15px] font-bold text-slate-900">
                    <span>{formatDateShort(startAt)}, {formatTime(startAt)}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{formatTime(endAt)}</span>
                  </div>

                  {showTimePicker && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
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
                  )}

                  {/* Extension buttons */}
                  <div className="mt-3 flex gap-2">
                    {extensionPricing.map(({ hrs, extra }) => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setEndAt(new Date(endAt.getTime() + hrs * 3600000))}
                        className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-center text-[12px] font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition"
                      >
                        +{hrs}hr{" "}
                        <span className="text-slate-400">€{extra.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>

                  {/* Easily change badge */}
                  <div className="mt-3 flex items-center gap-2 text-[12.5px] text-emerald-700">
                    <CheckCircle className="h-4 w-4 text-emerald-500" strokeWidth={2} />
                    Easily change & extend your booking
                  </div>
                </div>

                {/* Price breakdown */}
                <div className="px-6 py-5">
                  <p className="mb-3 text-[13px] font-bold text-slate-900">Price Breakdown</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-slate-500">Rate</span>
                      <span className="font-semibold text-slate-800">{formatListingPriceLine(listing)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-slate-500">Duration</span>
                      <span className="font-semibold text-slate-800">
                        {pricing?.billingCount ?? 0} {pricing?.billingUnit ?? "day"}{pricing?.billingCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-semibold text-slate-800">€{totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-slate-500">Platform fee</span>
                      <span className="font-semibold text-slate-800">Included</span>
                    </div>
                    <div className="mt-1 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-bold text-slate-900">Total</span>
                        <span className="text-[18px] font-extrabold tracking-tight text-slate-900">
                          €{totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-400">No hidden fees will be added at checkout.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckoutNav() {
  return (
    <div className="relative border-b border-slate-200 bg-white">
      <SlimNav />
      <div className="pointer-events-none absolute inset-y-0 right-6 flex items-center gap-1.5 text-[13px] font-semibold text-slate-500">
        <Lock className="h-3.5 w-3.5" />
        Secure Checkout
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      {children}
    </div>
  );
}
