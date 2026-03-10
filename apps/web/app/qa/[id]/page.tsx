"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createPortalBooking, getListing, type ListingDetail } from "../../../lib/api";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function QaPortalPage() {
  const params = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const now = useMemo(() => new Date(), []);
  const defaultUntil = useMemo(() => new Date(now.getTime() + 2 * 60 * 60 * 1000), [now]);
  const [untilLocal, setUntilLocal] = useState(toLocalInputValue(defaultUntil));

  useEffect(() => {
    const listingId = params?.id;
    if (!listingId) return;
    getListing(listingId)
      .then(setListing)
      .catch(() => setError("Could not load parking location"));
  }, [params?.id]);

  const fromDate = useMemo(() => new Date(), [untilLocal]);
  const untilDate = useMemo(() => new Date(untilLocal), [untilLocal]);
  const durationHours = useMemo(() => {
    const ms = untilDate.getTime() - fromDate.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  }, [fromDate, untilDate]);
  const billingDays = Math.max(1, Math.ceil(durationHours / 24));
  const total = listing ? listing.pricePerDay * billingDays : 0;
  const plateValid = vehiclePlate.trim().length >= 2;
  const timeValid = untilDate.getTime() > Date.now();
  const canContinue = (current: number) => {
    if (current === 1) return plateValid;
    if (current === 2) return timeValid;
    return true;
  };

  const handlePay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listing) return;
    if (!plateValid) {
      setError("Enter a valid registration");
      return;
    }
    if (!timeValid) {
      setError("End time must be in the future");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await createPortalBooking({
        listingId: listing.id,
        until: untilDate.toISOString(),
        vehiclePlate: vehiclePlate.trim(),
      });
      setCheckoutUrl(res.checkoutUrl);
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!listing) {
    return <div className="mx-auto max-w-xl px-4 py-10 text-sm text-slate-600">Loading parking portal…</div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <header className="space-y-4 text-center">
        <img src="/freespace-logo.png" alt="FreeSpace" className="mx-auto h-20 w-auto sm:h-24" />
        <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          QR check-in
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{listing.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{listing.address}</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">€{listing.pricePerDay} / day</p>
        </div>
      </header>

      <form onSubmit={handlePay} className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span className={step === 1 ? "text-emerald-700" : ""}>1. Vehicle</span>
          <span className={step === 2 ? "text-emerald-700" : ""}>2. Time</span>
          <span className={step === 3 ? "text-emerald-700" : ""}>3. Pay</span>
        </div>

        {step === 1 && (
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Vehicle registration
            <input
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              placeholder="251D12345"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              maxLength={12}
              required
            />
          </label>
        )}

        {step === 2 && (
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Park until
            <input
              type="datetime-local"
              value={untilLocal}
              onChange={(e) => setUntilLocal(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              required
            />
          </label>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Vehicle</span>
                <span className="font-semibold">{vehiclePlate || "—"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Duration</span>
                <span className="font-semibold">{durationHours} hour(s)</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Total</span>
                <span className="text-lg font-semibold text-slate-900">€{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        {checkoutUrl ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Redirecting to payment…</div> : null}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={step === 1 || submitting}
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (!canContinue(step)) {
                  setError(step === 1 ? "Enter a valid registration" : "End time must be in the future");
                  return;
                }
                setError(null);
                setStep((s) => ((s + 1) as 1 | 2 | 3));
              }}
              className="rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-brand-600"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-brand-600 disabled:opacity-70"
            >
              {submitting ? "Starting payment..." : "Pay for parking"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
