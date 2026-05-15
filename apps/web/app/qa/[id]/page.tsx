"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createPortalBooking, getListing, type ListingDetail } from "../../../lib/api";

const MOCK_ID = "st-stephens-green-carpark";
const MOCK_LISTING: ListingDetail = {
  id: MOCK_ID,
  title: "St Stephen's Green Carpark",
  address: "St Stephen’s Green, Dublin 2",
  pricePerDay: 20,
  availability: "Monday - Sunday (24 hours)",
  amenities: ["CCTV", "Covered", "Gated"],
  imageUrls: ["/hero-art.png"],
  rating: 4.7,
  ratingCount: 214,
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const TIME_SLOTS = Array.from({ length: 24 * 2 }, (_, i) =>
  `${pad2(Math.floor(i / 2))}:${i % 2 === 0 ? "00" : "30"}`,
);

function pad2(n: number) { return String(n).padStart(2, "0"); }
function addMinutes(d: Date, mins: number) { return new Date(d.getTime() + mins * 60000); }
function snapTo30(d: Date): Date {
  const out = new Date(d);
  out.setMinutes(Math.ceil(out.getMinutes() / 30) * 30, 0, 0);
  return out;
}
function formatDatetime(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  let label: string;
  if (day.getTime() === today.getTime()) label = "Today";
  else if (day.getTime() === tomorrow.getTime()) label = "Tomorrow";
  else label = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()].slice(0, 3)}`;
  return `${label}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function QaPortalPage() {
  const params = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  const now = useMemo(() => snapTo30(new Date()), []);
  const defaultUntil = useMemo(() => addMinutes(now, 120), [now]);
  const [untilAt, setUntilAt] = useState(defaultUntil);

  const isMock = params?.id === MOCK_ID;

  useEffect(() => {
    const listingId = params?.id;
    if (!listingId) return;
    if (listingId === MOCK_ID) {
      setListing(MOCK_LISTING);
      return;
    }
    getListing(listingId)
      .then(setListing)
      .catch(() => setError("Could not load parking location"));
  }, [params?.id]);

  const fromDate = useMemo(() => new Date(), []);
  const untilDate = useMemo(() => new Date(untilAt), [untilAt]);
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
    if (isMock) {
      setCheckoutUrl("mock");
      return;
    }
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
    <div className="min-h-[100dvh] bg-slate-50">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <img src="/freespace-logo.png" alt="FreeSpace" className="h-8 w-auto" />
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">Location ID</p>
          <p className="text-lg font-semibold">{listing.id.slice(0, 6).toUpperCase()}</p>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
        <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Parking at</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">{listing.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{listing.address}</p>
        </div>

        <form onSubmit={handlePay} className="space-y-4 rounded-3xl bg-white px-4 py-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className={step === 1 ? "text-emerald-700" : ""}>1. Vehicle</span>
            <span className={step === 2 ? "text-emerald-700" : ""}>2. Time</span>
            <span className={step === 3 ? "text-emerald-700" : ""}>3. Pay</span>
          </div>

          {step === 1 && (
            <div className="rounded-2xl bg-emerald-50 px-4 py-5">
              <label className="flex flex-col gap-3 text-sm font-semibold text-slate-800">
                Enter your vehicle registration
                <div className="flex overflow-hidden rounded-lg border-2 border-slate-900 bg-white">
                  <div className="w-10 bg-[#0B3A8F]" />
                  <div className="flex-1 px-3 py-2">
                    <input
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      className="w-full bg-transparent text-center text-2xl font-semibold tracking-[2px] text-slate-700 focus:outline-none"
                      maxLength={12}
                      required
                    />
                  </div>
                </div>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-800">When will you be leaving?</p>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="mt-4 flex w-full flex-col rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
              >
                <span className="text-xs font-semibold text-emerald-700">Departure time</span>
                <span className="mt-1 text-sm font-bold text-slate-900">{formatDatetime(untilAt)}</span>
              </button>
            </div>
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
          {checkoutUrl ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {isMock ? "Test mode: payment flow will be wired after launch." : "Redirecting to payment…"}
            </div>
          ) : null}

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
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-70"
              >
                {submitting ? "Starting payment..." : "Pay for parking"}
              </button>
            )}
          </div>
        </form>
      </div>

      {pickerOpen && (
        <DateTimeSheet
          value={untilAt}
          onConfirm={(next) => { setUntilAt(next); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function DateTimeSheet({
  value,
  onConfirm,
  onClose,
}: {
  value: Date;
  onConfirm: (d: Date) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const calDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push(new Date(viewYear, viewMonth, d));
    }
    return cells;
  }, [viewYear, viewMonth]);

  const timeValue = `${pad2(draft.getHours())}:${pad2(draft.getMinutes())}`;
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-[18px] font-semibold text-[#0f172a]">Park until</h2>
        <button type="button" onClick={onClose} className="text-[14px] font-semibold text-brand-600">
          Cancel
        </button>
      </div>

      <div className="flex items-center justify-between px-5 pb-3">
        <span className="text-[14px] font-semibold text-[#1F2937]">
          {MONTHS_LONG[viewMonth]} {viewYear}
        </span>
        <div className="flex items-center gap-3 text-brand-600">
          <button type="button" onClick={prevMonth} className="p-1 text-brand-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={nextMonth} className="p-1 text-brand-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 px-5 pb-2">
        {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#B0B8C5]">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 content-start gap-y-2 px-5 py-2">
        {calDays.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
          const isToday = dayStart.getTime() === today.getTime();
          const isSelected = draft.toDateString() === day.toDateString();
          return (
            <button
              key={day.getTime()}
              type="button"
              onClick={() => {
                const next = new Date(day);
                next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
                setDraft(next);
              }}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition
                ${isSelected ? "bg-brand-500 font-semibold text-white" :
                  isToday ? "border border-brand-500 text-brand-700 font-semibold" :
                  "font-medium text-[#0f172a] active:bg-[#F1F5F9]"}
              `}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div
        className="mt-auto flex items-center gap-3 border-t border-[#EEF2F7] px-5 py-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <span className="text-[13px] text-[#6B7280]">Leave by</span>
        <div className="relative">
          <select
            value={timeValue}
            onChange={(e) => {
              if (!e.target.value) return;
              const [h, m] = e.target.value.split(":").map(Number);
              const next = new Date(draft);
              next.setHours(h, m, 0, 0);
              setDraft(next);
            }}
            className="appearance-none rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-3 pr-8 text-[14px] font-semibold text-[#0f172a] focus:outline-none"
          >
            {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => onConfirm(draft)}
          className="ml-auto rounded-xl bg-brand-500 px-6 py-2.5 text-[14px] font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
