"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Clock,
  KeyRound,
  Lock,
  MapPin,
  Phone,
  Receipt,
  ShieldCheck,
  Star,
} from "lucide-react";
import { getBooking, cancelDriverBooking, createReview, type BookingSummary } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { useToast } from "../../../components/Toaster";
import { SlimNav } from "../../../components/SlimNav";
import { DashboardShell } from "../../../components/DashboardShell";

// Access details unlock this long before arrival — the code isn't useful
// earlier, and holding it back keeps it out of screenshots shared in advance.
const ACCESS_UNLOCK_MS = 2 * 60 * 60 * 1000;

function phase(b: BookingSummary): "upcoming" | "active" | "past" | "cancelled" {
  const s = b.status.toLowerCase();
  if (s === "cancelled" || s === "canceled") return "cancelled";
  const now = Date.now();
  const start = new Date(b.startTime).getTime();
  const end = new Date(b.endTime).getTime();
  if (now >= start && now <= end) return "active";
  if (start > now) return "upcoming";
  return "past";
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();
  const day = isToday ? "Today" : isTomorrow ? "Tomorrow" : d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IE", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day} at ${time}`;
}

function icsStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Build a calendar event the driver can drop into Apple/Google/Outlook — the
// "they thought of that" touch that turns a confirmation into a plan.
function downloadCalendar(b: BookingSummary) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FreeSpace//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@freespace.ie`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(b.startTime)}`,
    `DTEND:${icsStamp(b.endTime)}`,
    `SUMMARY:Parking — ${b.title}`,
    `LOCATION:${b.address.replace(/,/g, "\\,")}`,
    `DESCRIPTION:Your FreeSpace parking booking. Ref ${b.id.slice(0, 8).toUpperCase()}.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `freespace-${b.id.slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function durationLabel(start: string, end: string) {
  const mins = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h}h ${m}m`;
}

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const { showToast } = useToast();

  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const id = params?.id;

  const refresh = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await getBooking(id, token);
      setBooking(data);
    } catch {
      setNotFound(true);
    } finally {
      setFetching(false);
    }
  }, [id, token]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/bookings/${id ?? ""}`)}`);
      return;
    }
    void refresh();
  }, [loading, user, id, refresh, router]);

  const ph = booking ? phase(booking) : null;
  const accessUnlocked = useMemo(() => {
    if (!booking) return false;
    return Date.now() >= new Date(booking.startTime).getTime() - ACCESS_UNLOCK_MS;
  }, [booking]);

  const directionsHref = useMemo(() => {
    if (!booking) return "#";
    if (typeof booking.latitude === "number" && typeof booking.longitude === "number") {
      return `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`;
  }, [booking]);

  const refundEligible = useMemo(() => {
    if (!booking) return false;
    return Date.now() < new Date(booking.startTime).getTime() - ACCESS_UNLOCK_MS;
  }, [booking]);

  const handleCancel = async () => {
    if (!booking || !token) return;
    setCancelling(true);
    try {
      const res = await cancelDriverBooking(booking.id, token);
      setConfirmOpen(false);
      showToast(res.refunded ? "Booking cancelled — refund on its way" : "Booking cancelled", "success");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not cancel booking", "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleReview = async () => {
    if (!booking || !token || reviewSubmitting) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      await createReview({ bookingId: booking.id, rating: reviewRating, comment: reviewComment.trim() || undefined }, token);
      setReviewDone(true);
      showToast("Thanks for your review", "success");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not submit your review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ── States ────────────────────────────────────────────────────────────────
  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SlimNav />
        <DashboardShell>
          <div className="space-y-4">
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        </DashboardShell>
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SlimNav />
        <DashboardShell>
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <p className="text-[16px] font-bold text-slate-900">Booking not found</p>
            <p className="mt-1.5 text-[13.5px] text-slate-500">It may have been removed, or the link is no longer valid.</p>
            <Link href="/bookings" className="mt-5 inline-block rounded-xl bg-brand-500 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-brand-600">
              Back to my bookings
            </Link>
          </div>
        </DashboardShell>
      </div>
    );
  }

  const amount = (booking.amountCents / 100).toFixed(2);
  const img = booking.imageUrls?.[0] ?? null;
  const cancelled = ph === "cancelled";
  const canCancel = ph === "upcoming" || ph === "active";

  return (
    <div className="min-h-screen bg-slate-50">
      <SlimNav />
      <DashboardShell>
        <div className="space-y-5">
          {/* Back */}
          <Link href="/bookings" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} /> My bookings
          </Link>

          {/* Header card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(15,23,42,0.16)]">
            {img && (
              <div className="relative h-44 w-full">
                <Image src={img} alt={booking.title} fill className="object-cover" sizes="640px" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                    cancelled ? "bg-rose-50 text-rose-600" : ph === "active" ? "bg-brand-50 text-brand-700" : "bg-white/90 text-slate-700"
                  }`}>
                    {cancelled ? "Cancelled" : ph === "active" ? "In progress" : ph === "past" ? "Completed" : "Confirmed"}
                  </span>
                </div>
              </div>
            )}
            <div className="px-6 py-5">
              {!img && (
                <span className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                  cancelled ? "bg-rose-50 text-rose-600" : ph === "active" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-700"
                }`}>
                  {cancelled ? "Cancelled" : ph === "active" ? "In progress" : ph === "past" ? "Completed" : "Confirmed"}
                </span>
              )}
              <h1 className="text-[21px] font-bold leading-snug tracking-[-0.02em] text-slate-950">{booking.title}</h1>
              <p className="mt-1.5 flex items-start gap-1.5 text-[13.5px] text-slate-500">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                {booking.address}
              </p>
              {!cancelled && (
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-slate-800"
                  >
                    Get directions <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </a>
                  <button
                    type="button"
                    onClick={() => downloadCalendar(booking)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} /> Add to calendar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* When */}
          <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-5 shadow-sm">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-900">When</h2>
            <dl className="mt-4 space-y-3.5">
              <Row icon={<CalendarCheck className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} />} label="Arriving" value={formatDateTime(booking.startTime)} />
              <Row icon={<CalendarClock className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} />} label="Leaving" value={formatDateTime(booking.endTime)} />
              <Row icon={<Clock className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} />} label="Duration" value={durationLabel(booking.startTime, booking.endTime)} />
            </dl>
          </div>

          {/* Access — the thing you actually need on arrival */}
          {!cancelled && (booking.accessCode || booking.arrivalInstructions) && (
            <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] text-slate-900">
                <KeyRound className="h-4 w-4 text-brand-600" strokeWidth={2} /> Getting in
              </h2>
              {accessUnlocked ? (
                <div className="mt-4 space-y-4">
                  {booking.accessCode && (
                    <div>
                      <p className="text-[12px] font-medium text-slate-500">Access code</p>
                      <p className="mt-1 font-mono text-[24px] font-bold tracking-[0.2em] text-slate-900">{booking.accessCode}</p>
                    </div>
                  )}
                  {booking.arrivalInstructions && (
                    <div>
                      <p className="text-[12px] font-medium text-slate-500">Arrival instructions</p>
                      <p className="mt-1 text-[14px] leading-[1.6] text-slate-700">{booking.arrivalInstructions}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3.5">
                  <Lock className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                  <p className="text-[13px] text-slate-600">
                    Access details unlock 2 hours before you arrive, so they&apos;re fresh when you need them.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Vehicle + host */}
          {!cancelled && (booking.vehiclePlate || booking.hostPhone) && (
            <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-5 shadow-sm">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-900">Details</h2>
              <dl className="mt-4 space-y-3.5">
                {booking.vehiclePlate && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[13.5px] text-slate-500">Vehicle</dt>
                    <dd className="font-mono text-[14px] font-semibold uppercase tracking-[0.12em] text-slate-900">{booking.vehiclePlate}</dd>
                  </div>
                )}
                {booking.hostPhone && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[13.5px] text-slate-500">Host</dt>
                    <dd>
                      <a href={`tel:${booking.hostPhone}`} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-600 hover:text-brand-700">
                        <Phone className="h-3.5 w-3.5" strokeWidth={2} /> {booking.hostPhone}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Payment */}
          <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-5 shadow-sm">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-900">Payment</h2>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[13.5px] text-slate-500">Total paid</span>
              <span className="text-[16px] font-bold text-slate-900">€{amount}</span>
            </div>
            {booking.refundStatus === "refunded" && (
              <p className="mt-2 text-[12.5px] font-medium text-brand-600">Refunded to your original payment method.</p>
            )}
            {booking.receiptUrl && (
              <a href={booking.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-800">
                <Receipt className="h-3.5 w-3.5" strokeWidth={2} /> View receipt
              </a>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} /> Ref {booking.id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          {/* Review — offered exactly when it's natural: just after the trip */}
          {ph === "past" && (
            <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-5 shadow-sm">
              {reviewDone ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50">
                    <Star className="h-4 w-4 fill-brand-500 text-brand-500" strokeWidth={2} />
                  </div>
                  <p className="text-[14px] font-semibold text-slate-900">Thanks for reviewing this space</p>
                </div>
              ) : (
                <>
                  <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-900">How was it?</h2>
                  <p className="mt-1 text-[13px] text-slate-500">Your review helps other drivers and the host.</p>
                  <div className="mt-3 flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewRating(n)}
                        aria-label={`${n} star${n > 1 ? "s" : ""}`}
                        className="transition hover:scale-110"
                      >
                        <Star className={`h-7 w-7 ${n <= reviewRating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"}`} strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    placeholder="Share a few words about the space (optional)"
                    className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                  {reviewError && <p className="mt-2 text-[12.5px] text-rose-600">{reviewError}</p>}
                  <button
                    type="button"
                    onClick={() => void handleReview()}
                    disabled={reviewSubmitting}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-[14px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {reviewSubmitting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                    Submit review
                  </button>
                </>
              )}
            </div>
          )}

          {/* Cancel */}
          {canCancel && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 text-[14px] font-bold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                Cancel booking
              </button>
              <p className="mt-2 text-center text-[12px] text-slate-400">
                {refundEligible ? "Free cancellation — you'll be fully refunded." : "Within 2 hours of arrival — a refund may not apply."}
              </p>
            </div>
          )}
          {cancelled && (
            <Link href="/" className="block rounded-xl bg-brand-500 py-3 text-center text-[14px] font-bold text-white transition hover:bg-brand-600">
              Find another space
            </Link>
          )}
        </div>
      </DashboardShell>

      {/* Cancel confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0" onClick={() => !cancelling && setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-bold tracking-[-0.01em] text-slate-950">Cancel this booking?</h3>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-slate-600">
              {refundEligible
                ? `You'll be fully refunded €${amount} to your original payment method.`
                : `Your arrival is within 2 hours, so a refund may not apply. You'll lose this space.`}
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={cancelling}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={cancelling}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-[14px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {cancelling && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                Cancel booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2.5 text-[13.5px] text-slate-500">{icon} {label}</dt>
      <dd className="text-[14px] font-semibold tracking-[-0.011em] text-slate-900">{value}</dd>
    </div>
  );
}
