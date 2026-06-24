"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBooking, getListing, type ListingDetail } from "../../../lib/api";
import { calculateListingTotal, formatListingPriceLine } from "../../../lib/pricing";
import { useAuth } from "../../../components/AuthProvider";
import { SlimNav } from "../../../components/SlimNav";
import { SearchDateTimePicker } from "../../../components/SearchForm";
import { GoogleSignInButton } from "../../../components/GoogleSignInButton";
import { TextField } from "../../../components/ui";
import { deriveFeatureKeys, type FeatureKey } from "../../../components/amenityFeatures";
import Image from "next/image";
import { Lock, Star, ArrowRight, CheckCircle, MapPin, Cctv, Zap, Home, ShieldCheck, CalendarClock, CalendarCheck, Clock } from "lucide-react";

const FEATURE_META: Record<FeatureKey, { label: string; Icon: typeof Home }> = {
  covered: { label: "Covered", Icon: Home },
  gated: { label: "Gated", Icon: Lock },
  cctv: { label: "CCTV", Icon: Cctv },
  ev: { label: "EV charging", Icon: Zap },
};

export default function CheckoutPage() {
  const { user, token, loading, signIn, signInWithGoogle, error: authError } = useAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [listingLoading, setListingLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState(() => user?.vehiclePlate ?? "");
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Deferred auth: the page is fully usable while signed out; we only ask the
  // driver to identify themselves when they commit at "Continue".
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [pendingBooking, setPendingBooking] = useState(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";

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

  const totalPrice = pricing?.total ?? 0;
  const serviceFee = Math.round(totalPrice * 0.08 * 100) / 100;
  const grossTotal = totalPrice + serviceFee;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const toTimeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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
    getListing(id)
      .then(setListing)
      .catch(() => setError("This listing could not be found. It may have been removed."))
      .finally(() => setListingLoading(false));
  }, [params?.id]);

  useEffect(() => {
    if (user?.vehiclePlate) setVehiclePlate(user.vehiclePlate);
  }, [user?.vehiclePlate]);

  const startBooking = async () => {
    if (!token || !listing) return;
    setStatus("loading");
    setError(null);
    try {
      const from = `${toDateStr(startAt)}T${toTimeStr(startAt)}:00Z`;
      const to = `${toDateStr(endAt)}T${toTimeStr(endAt)}:00Z`;
      const amountCents = Math.max(1, Math.round(grossTotal * 100));
      const res = await createBooking(
        { listingId: listing.id, from, to, amountCents, currency: "eur", platformFeePercent: 8 / 108, vehiclePlate: vehiclePlate.trim() || undefined },
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!listing) return;
    // Signed out: don't block the flow — reveal the inline sign-in and resume
    // the booking automatically once the driver is authenticated.
    if (!token) {
      setPendingBooking(true);
      if (typeof document !== "undefined") {
        document.getElementById("checkout-auth")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    void startBooking();
  };

  // Resume the booking the moment auth completes after a "Continue" click.
  useEffect(() => {
    if (pendingBooking && token && listing) {
      setPendingBooking(false);
      void startBooking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBooking, token, listing]);

  const handleInlineGoogle = async (credential: string) => {
    setError(null);
    try {
      await signInWithGoogle(credential);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed. Try again.");
    }
  };

  const submitInlineEmail = async () => {
    setError(null);
    try {
      await signIn(authEmail, authPassword);
    } catch {
      // surfaced via authError
    }
  };

  // ── Loading / auth gates ──────────────────────────────────────────────────────

  if (loading || listingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-white">
        <CheckoutNav />
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-[17px] font-bold text-slate-900">Listing unavailable</p>
          <p className="mt-2 text-[14px] text-slate-600">{error ?? "This listing could not be found."}</p>
          <Link href="/search" className="mt-6 inline-block rounded-xl bg-brand-500 px-6 py-3 text-[14px] font-bold text-white hover:bg-brand-600">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const nextPath = `/checkout/${params?.id}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
  const hasRating = typeof listing.rating === "number" && listing.rating > 0;
  const features = deriveFeatureKeys(listing.amenities, listing.title);
  const directionsHref =
    typeof listing.latitude === "number" && typeof listing.longitude === "number"
      ? `https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`;
  const imgSrc = (listing.imageUrls ?? (listing as any).image_urls)?.[0] ?? (listing as any).image ?? null;
  const ctaLabel =
    status === "loading"
      ? "Opening secure checkout…"
      : !user
      ? `Sign in & continue · €${grossTotal.toFixed(2)}`
      : `Continue to payment · €${grossTotal.toFixed(2)}`;
  const cancelDeadline = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
  const cancelPromise =
    cancelDeadline.getTime() > Date.now()
      ? `Free cancellation until ${formatDateShort(cancelDeadline)}, ${formatTime(cancelDeadline)}`
      : "Free cancellation up to 2 hours before start";
  return (
    <div className="min-h-screen bg-[#f7f7f6] pb-28 lg:pb-0">
      <CheckoutNav />

      <form id="checkout-form" onSubmit={handleSubmit}>
        <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-12">
          {/* Page heading — a calm, confident sense of the final step */}
          <div className="mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-500">Almost there</p>
            <h1 className="mt-1.5 text-[30px] font-extrabold leading-[1.05] tracking-[-0.035em] text-slate-950 sm:text-[34px]">
              Confirm your booking and pay
            </h1>
          </div>

          {/* Stacks on mobile (summary on top), two columns from lg up. */}
          <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start lg:gap-10">

            {/* ── Left column ── */}
            <div className="min-w-0 flex-1 space-y-5">

              {/* Booking details — scannable facts, the anchor of the left column */}
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-bold tracking-[-0.012em] text-slate-900">Booking details</h2>
                  <button
                    type="button"
                    onClick={() => setShowTimePicker((s) => !s)}
                    className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {showTimePicker ? "Done" : "Edit"}
                  </button>
                </div>

                <dl className="mt-4 space-y-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2.5 text-[13.5px] text-slate-500">
                      <CalendarCheck className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} /> Arriving
                    </dt>
                    <dd className="text-[14px] font-semibold tracking-[-0.011em] tabular-nums text-slate-900">
                      {formatDateShort(startAt)} at {formatTime(startAt)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2.5 text-[13.5px] text-slate-500">
                      <CalendarClock className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} /> Leaving
                    </dt>
                    <dd className="text-[14px] font-semibold tracking-[-0.011em] tabular-nums text-slate-900">
                      {formatDateShort(endAt)} at {formatTime(endAt)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2.5 text-[13.5px] text-slate-500">
                      <Clock className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} /> Duration
                    </dt>
                    <dd className="text-[14px] font-semibold tracking-[-0.011em] text-slate-900">
                      {pricing?.durationLabel ?? "—"}
                    </dd>
                  </div>
                </dl>

                {showTimePicker && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
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

              </Card>

              {/* Contact info (signed in) / inline sign-in (guest) */}
              {user ? (
                <Card>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-[16px] font-bold tracking-[-0.012em] text-slate-900">Contact Info</h2>
                      <p className="mt-0.5 text-[13px] text-slate-600">
                        {user.name ?? user.email}
                      </p>
                      {user.name && (
                        <p className="text-[13px] text-slate-600">{user.email}</p>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/profile?next=${encodeURIComponent(nextPath)}` as any}
                      className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Change
                    </Link>
                  </div>
                  <p className="mt-2 text-[12.5px] text-slate-500">
                    Confirmation and updates are sent to this email.
                  </p>
                </Card>
              ) : (
                <Card>
                  <div id="checkout-auth" className="mx-auto max-w-[400px]">
                    <h2 className="text-center text-[16px] font-bold tracking-[-0.012em] text-slate-900">Sign in to continue</h2>
                    <div className="mt-4 space-y-2.5">
                      {googleClientId && (
                        <GoogleSignInButton
                          text="continue_with"
                          onSuccess={handleInlineGoogle}
                          onError={() => setError("Google sign-in failed. Try again.")}
                        />
                      )}
                      <div className="flex items-center gap-3 py-0.5">
                        <span className="h-px flex-1 bg-slate-100" />
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">or</span>
                        <span className="h-px flex-1 bg-slate-100" />
                      </div>
                      {!showEmailAuth ? (
                        <button
                          type="button"
                          onClick={() => setShowEmailAuth(true)}
                          className="flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Continue with email
                        </button>
                      ) : (
                        <div
                          className="space-y-3"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void submitInlineEmail();
                            }
                          }}
                        >
                          <TextField required type="email" label="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                          <TextField required type="password" label="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                          <button
                            type="button"
                            onClick={() => void submitInlineEmail()}
                            disabled={loading}
                            className="flex h-10 w-full items-center justify-center rounded-xl bg-brand-600 text-[14px] font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
                          >
                            {loading ? "Signing in…" : "Sign in"}
                          </button>
                        </div>
                      )}
                      {authError && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] text-rose-700">
                          {authError}
                        </div>
                      )}
                      <p className="pt-0.5 text-center text-[12.5px] text-slate-500">
                        No account?{" "}
                        <Link
                          href={`/signup?next=${encodeURIComponent(nextPath)}` as any}
                          className="font-semibold text-brand-600 hover:text-brand-700"
                        >
                          Sign up free
                        </Link>
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Vehicle */}
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-bold tracking-[-0.012em] text-slate-900">Vehicle</h2>
                  {vehiclePlate && (
                    <button
                      type="button"
                      onClick={() => setVehiclePlate("")}
                      className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Change
                    </button>
                  )}
                </div>
                {vehiclePlate ? (
                  <div className="mt-3 inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <span className="font-mono text-[15px] font-semibold uppercase tracking-[0.14em] text-slate-900">
                      {vehiclePlate}
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <label className="block text-[13px] font-semibold text-slate-700">
                      Reg plate
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="241-D-12345"
                        maxLength={12}
                        onChange={(e) => {
                          const v = e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, "");
                          e.target.value = v;
                        }}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v) setVehiclePlate(v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = (e.target as HTMLInputElement).value.trim();
                            if (v) setVehiclePlate(v);
                          }
                        }}
                        className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-[14px] font-semibold uppercase tracking-widest text-slate-900 outline-none placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      />
                    </div>
                    <p className="text-[12px] text-slate-500">Optional — add any time before you arrive.</p>
                  </div>
                )}
              </Card>

              {/* Payment */}
              <Card>
                <h2 className="text-[16px] font-bold tracking-[-0.012em] text-slate-900">Payment</h2>
                <div className="mt-3 flex items-center gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50">
                    <Lock className="h-[19px] w-[19px] text-brand-600" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold tracking-[-0.011em] text-slate-900">Pay securely with Stripe</p>
                    <p className="text-[12.5px] text-slate-500">Encrypted · card details never stored by us</p>
                  </div>
                </div>
                <p className="mt-3 text-[12px] font-medium text-slate-500">
                  Visa · Mastercard · Amex · Apple Pay · Google Pay
                </p>
              </Card>

              {/* Error / success */}
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                  <div className="font-semibold">{error}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-rose-700">
                    Your booking has not been confirmed yet. Check the details and try again.
                  </p>
                </div>
              )}
              {status === "success" && checkoutUrl && (
                <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
                  Opening secure Stripe checkout…{" "}
                  <a className="font-semibold underline underline-offset-2" href={checkoutUrl}>Click here</a> if nothing happens.
                </div>
              )}

              {/* Pay button — desktop (mobile uses the sticky bar) */}
              <button
                type="submit"
                form="checkout-form"
                disabled={status === "loading"}
                className="hidden w-full items-center justify-center rounded-xl bg-brand-600 py-4 text-[15px] font-bold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 lg:flex"
              >
                {ctaLabel}
              </button>

              <p className="text-center text-[12px] leading-relaxed text-slate-500">
                Your space is reserved once Stripe confirms payment. By continuing you agree to our{" "}
                <Link href="/legal/parking-terms-liability" className="font-medium text-slate-600 underline underline-offset-2">
                  Terms
                </Link>{" "}
                &amp;{" "}
                <Link href="/legal/privacy-policy" className="font-medium text-slate-600 underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            {/* ── Right column — the booking, presented as the hero ── */}
            <div className="w-full lg:w-[430px] lg:shrink-0">
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)] lg:sticky lg:top-8">

                {/* Listing image */}
                {imgSrc && (
                  <div className="relative h-52 w-full overflow-hidden">
                    <Image src={imgSrc} alt={listing.title} fill className="object-cover" sizes="430px" priority />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    {hasRating && (
                      <div className="absolute bottom-3 left-4 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-sm">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {listing.rating!.toFixed(1)}
                        {(listing.ratingCount ?? 0) > 0 && <span className="font-normal opacity-80">({listing.ratingCount})</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* What & where */}
                <div className="border-b border-slate-100 px-6 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Your booking</p>
                  <h2 className="mt-1.5 text-[21px] font-bold leading-[1.2] tracking-[-0.021em] text-slate-950">{listing.title}</h2>
                  {hasRating && !imgSrc && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-600">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-slate-700">{listing.rating!.toFixed(1)}</span>
                      {(listing.ratingCount ?? 0) > 0 && <span>({listing.ratingCount} reviews)</span>}
                    </div>
                  )}
                  <div className="mt-2.5 flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                    <p className="text-[13px] leading-relaxed text-slate-500">{listing.address}</p>
                  </div>
                  {features.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {features.map((f) => {
                        const { label, Icon } = FEATURE_META[f];
                        return (
                          <span
                            key={f}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] font-medium text-slate-700"
                          >
                            <Icon className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} /> {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Get directions <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>

                {/* Price */}
                <div className="px-6 py-5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Price</p>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">
                        {formatListingPriceLine(listing)} · {pricing?.durationLabel ?? "—"}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-800">€{totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Service fee</span>
                      <span className="font-semibold tabular-nums text-slate-800">€{serviceFee.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
                    <div>
                      <span className="text-[15px] font-bold tracking-[-0.01em] text-slate-900">Total</span>
                      <p className="text-[11.5px] text-slate-500">Taxes included — no hidden fees</p>
                    </div>
                    <span className="text-[27px] font-extrabold leading-none tracking-[-0.025em] tabular-nums text-slate-950">€{grossTotal.toFixed(2)}</span>
                  </div>
                  <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3.5">
                    <div className="flex items-center gap-2 text-[12.5px] font-semibold text-emerald-700">
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2} />
                      {cancelPromise}
                    </div>
                    <div className="flex items-center gap-2 text-[12.5px] font-medium text-slate-500">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                      Every booking is protected by FreeSpace
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </form>

      {/* Mobile sticky pay bar — keeps price + CTA in view at all times */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total</span>
          <span className="text-[18px] font-extrabold tracking-[-0.02em] tabular-nums text-slate-950">€{grossTotal.toFixed(2)}</span>
        </div>
        <button
          type="submit"
          form="checkout-form"
          disabled={status === "loading"}
          className="flex w-full items-center justify-center rounded-xl bg-brand-600 py-3.5 text-[15px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {ctaLabel}
        </button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
          <Lock className="h-3 w-3" strokeWidth={2} /> Secured by Stripe · Free cancellation
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckoutNav() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <SlimNav />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] sm:px-6">
      {children}
    </div>
  );
}
