"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BookingCard, type Booking } from "../../components/BookingCard";
import { cancelHostBooking, getMyBookings, createReview } from "../../lib/api";
import { useAuth } from "../../components/AuthProvider";

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading || user) return;
    router.replace(`/login?next=${encodeURIComponent("/dashboard")}`);
  }, [loading, user, router]);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [hostBookings, setHostBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelingHostBooking, setCancelingHostBooking] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDone, setReviewDone] = useState<string | null>(null); // booking id that was reviewed
  const [stats, setStats] = useState<{ driverCount: number; hostCount: number; hostEarnings: number }>({
    driverCount: 0,
    hostCount: 0,
    hostEarnings: 0,
  });
  const [tripsTab, setTripsTab] = useState<"upcoming" | "active" | "past">("upcoming");

  const formatVehicleSummary = (booking: {
    driverVehicleColor?: string | null;
    driverVehicleMake?: string | null;
    driverVehicleType?: string | null;
  }) =>
    [booking.driverVehicleColor, booking.driverVehicleMake, booking.driverVehicleType]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ");

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const date = startDate.toLocaleDateString("en-IE", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "Europe/Dublin",
    });
    const timeRange = `${startDate.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Dublin" })} - ${endDate.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Dublin" })}`;
    return { date, timeRange };
  };

  const load = useMemo(
    () => async () => {
      if (!token) return;
      setStatus("loading");
      setError(null);
      try {
        const data = await getMyBookings(token);
        const driverData = data?.driverBookings ?? [];
        const hostData = data?.hostBookings ?? [];
        setDriverBookings(
          driverData.map((b) => {
            const { date, timeRange } = formatDateRange(b.startTime, b.endTime);
            return {
              id: b.id,
              address: b.address,
              title: b.title,
              date,
              timeRange,
              payout: 0,
              role: "driver",
              driver: user?.email ?? "You",
              status: (b.status as Booking["status"]) ?? "pending",
              refundStatus: b.refundStatus,
              refundedAt: b.refundedAt,
              noShowAt: b.noShowAt,
              cancellationSource: b.cancellationSource ?? null,
              startTime: b.startTime,
              endTime: b.endTime,
            };
          })
        );
        setHostBookings(
          hostData.map((b) => {
            const { date, timeRange } = formatDateRange(b.startTime, b.endTime);
            return {
              id: b.id,
              address: b.address,
              title: b.title,
              date,
              timeRange,
              payout: (b.amountCents ?? 0) / 100,
              role: "host",
              driver: b.driverName ?? "Booked driver",
              vehiclePlate: b.vehiclePlate ?? null,
              vehicleSummary: formatVehicleSummary(b) || null,
              driverPhone: b.driverPhone ?? null,
              status: (b.status as Booking["status"]) ?? "pending",
              listingId: b.listingId,
              refundStatus: b.refundStatus,
              refundedAt: b.refundedAt,
              noShowAt: b.noShowAt,
              cancellationSource: b.cancellationSource ?? null,
              startTime: b.startTime,
              endTime: b.endTime,
              accessCode: b.accessCode ?? null,
              arrivalInstructions: b.arrivalInstructions ?? null,
            };
          })
        );
        setStats({
          driverCount: driverData.length,
          hostCount: hostData.length,
          hostEarnings: hostData.reduce((sum, b) => sum + (b.amountCents ?? 0), 0) / 100,
        });
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not load bookings");
      }
    },
    [token, user?.email]
  );

  useEffect(() => {
    load();
  }, [load]);

  const openSelected = (booking: Booking) => {
    setSelected(booking);
    setReviewMode(false);
    setReviewRating(5);
    setReviewComment("");
  };

  const handleSubmitReview = async () => {
    if (!token || !selected || reviewSubmitting) return;
    setReviewSubmitting(true);
    setError(null);
    try {
      await createReview({ bookingId: selected.id, rating: reviewRating, comment: reviewComment.trim() || undefined }, token);
      setReviewDone(selected.id);
      setReviewMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleHostCancel = async () => {
    if (!token || !selected?.id || cancelingHostBooking) return;
    if (!confirm("Cancel this booking? The driver will be refunded where eligible.")) return;
    setCancelingHostBooking(true);
    try {
      await cancelHostBooking(selected.id, token);
      await load();
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              status: "canceled",
              cancellationSource: "host",
              refundStatus: "succeeded",
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel booking");
    } finally {
      setCancelingHostBooking(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-600">Loading...</div>;

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase()
    || user?.email?.charAt(0)?.toUpperCase()
    || "?";

  return (
    <div>
      {/* ── Profile header — mobile only (desktop shows in sidebar) ── */}
      <div className="border-b border-slate-200 px-5 py-5 md:hidden">
        <Link href="/dashboard/personal-info" className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[17px] font-bold text-brand-600">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-slate-900">
              {user?.name?.trim() || "Your account"}
            </p>
            <p className="truncate text-[12.5px] text-slate-500">{user?.email}</p>
          </div>
          {user?.emailVerified && (
            <span className="ml-auto shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
              Verified
            </span>
          )}
        </Link>
      </div>

      {/* Page header — desktop */}
      <div className="hidden border-b border-slate-200 px-5 py-5 md:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Dashboard</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-slate-900">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px bg-slate-200">
        <div className="flex flex-col items-center justify-center bg-white px-4 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Trips</p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight text-slate-900">{stats.driverCount}</p>
        </div>
        <div className="flex flex-col items-center justify-center bg-white px-4 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Earnings</p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight text-brand-600">€{stats.hostEarnings.toFixed(0)}</p>
        </div>
        <div className="flex flex-col items-center justify-center bg-white px-4 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Payouts</p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight text-slate-900">{stats.hostCount}</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}

      {/* Driver bookings */}
      <section className="border-b border-slate-200 py-5">
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-slate-900">Your trips</h2>

        {/* Tabs */}
        {driverBookings.length > 0 && (() => {
          const now = new Date();
          const upcoming = driverBookings.filter((b) => new Date(b.startTime!) > now && b.status !== "canceled");
          const active   = driverBookings.filter((b) => new Date(b.startTime!) <= now && new Date(b.endTime!) >= now && b.status !== "canceled");
          const past     = driverBookings.filter((b) => b.status === "canceled" || new Date(b.endTime!) < now);
          const counts: Record<string, number> = { upcoming: upcoming.length, active: active.length, past: past.length };
          const visible  = tripsTab === "upcoming" ? upcoming : tripsTab === "active" ? active : past;
          const emptyMsg: Record<string, string> = {
            upcoming: "No upcoming trips",
            active:   "No active trips right now",
            past:     "No past trips",
          };
          return (
            <>
              <div className="mt-3 flex gap-1 rounded-xl border border-slate-200 p-1">
                {(["upcoming", "active", "past"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTripsTab(t)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold capitalize transition ${
                      tripsTab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t}
                    {counts[t] > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        tripsTab === t ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}>{counts[t]}</span>
                    )}
                  </button>
                ))}
              </div>
              {visible.length === 0 ? (
                <p className="mt-4 text-[13px] text-slate-600">{emptyMsg[tripsTab]}</p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {visible.map((booking) => (
                    <button key={booking.id} onClick={() => openSelected(booking)} className="w-full text-left">
                      <BookingCard booking={booking} />
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {status === "loading" && driverBookings.length === 0 && (
          <div className="mt-4 flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        )}
        {status !== "loading" && driverBookings.length === 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
            <p className="text-[14px] font-semibold text-slate-700">No bookings yet</p>
            <p className="mt-1 text-[13px] text-slate-600">Search for a space to make your first booking.</p>
            <Link href="/" className="mt-3 inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-2.5 text-[13px] font-semibold text-white">Find a space</Link>
          </div>
        )}
      </section>

      {/* Host bookings */}
      <section className="py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-slate-900">Host bookings</h2>
          {hostBookings.length > 0 && (
            <span className="text-[12px] font-medium text-slate-600">{hostBookings.length} total</span>
          )}
        </div>
        {hostBookings.length === 0 && status === "idle" ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-[14px] font-semibold text-slate-700">No host bookings yet</p>
            <p className="mt-1 text-[13px] text-slate-600">List a space to start earning.</p>
            <Link href="/host" className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-2.5 text-[13px] font-semibold text-white">List a space</Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {hostBookings.map((booking) => (
              <button key={booking.id} onClick={() => openSelected(booking)} className="w-full text-left">
                <BookingCard booking={booking} />
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-t-xl bg-white sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[15px] font-bold text-slate-900">{selected.title ?? selected.address}</p>
                  <p className="mt-0.5 text-[13px] text-slate-600">{selected.date} · {selected.timeRange}</p>
                </div>
                <button onClick={() => setSelected(null)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 active:bg-slate-50">
                  Close
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  selected.status === "pending" ? "bg-amber-50 text-amber-700"
                  : selected.status === "confirmed" ? "bg-brand-50 text-brand-700"
                  : selected.status === "canceled" ? "bg-rose-50 text-rose-700"
                  : "bg-slate-100 text-slate-700"}`}>
                  {selected.status}
                </span>
                {typeof selected.payout === "number" && selected.payout > 0 && (
                  <span className="text-[13px] font-semibold text-slate-700">€{selected.payout.toFixed(2)} payout</span>
                )}
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
            {selected.role === "host" ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[13px] font-semibold text-slate-800">Driver details</p>
                <p className="text-[13px] text-slate-600">{selected.driver ?? "Driver details unavailable"}</p>
                {selected.vehicleSummary || selected.vehiclePlate ? (
                  <p className="text-[13px] text-slate-600">
                    {selected.vehicleSummary ? `${selected.vehicleSummary} · ` : ""}
                    {selected.vehiclePlate ?? "Vehicle details unavailable"}
                  </p>
                ) : null}
                {selected.driverPhone?.trim() ? (
                  <p className="text-[13px] text-slate-600">Phone: {selected.driverPhone.trim()}</p>
                ) : null}
                {selected.arrivalInstructions?.trim() ? (
                  <p className="text-[13px] text-slate-600">Arrival: {selected.arrivalInstructions.trim()}</p>
                ) : null}
                {selected.accessCode?.trim() ? (
                  <p className="text-[13px] text-slate-600">
                    Access code: <span className="font-semibold text-slate-800">{selected.accessCode.trim()}</span>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-slate-600">Booked by you</p>
            )}
            {selected.noShowAt ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                This booking has been marked as a no-show.
              </div>
            ) : null}

            {/* Leave a review — shown for driver (confirmed, ended) bookings */}
            {(() => {
              const isDriverBooking = selected.role === "driver";
              const isConfirmed = selected.status === "confirmed";
              const isEnded = selected.endTime ? new Date(selected.endTime) <= new Date() : false;
              const alreadyReviewed = reviewDone === selected.id;
              if (!isDriverBooking || !isConfirmed || !isEnded) return null;
              if (alreadyReviewed) {
                return (
                  <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
                    ✓ Review submitted — thank you!
                  </div>
                );
              }
              if (!reviewMode) {
                return (
                  <button type="button" onClick={() => setReviewMode(true)}
                    className="w-full rounded-xl border border-amber-200 bg-amber-50 py-3 text-[13px] font-semibold text-amber-800 active:bg-amber-100">
                    ★ Leave a review
                  </button>
                );
              }
              return (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-[14px] font-bold text-slate-900">Leave a review</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className={`text-2xl transition ${star <= reviewRating ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience (optional)"
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-800 focus:border-brand-500 focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setReviewMode(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 active:bg-slate-50">
                      Cancel
                    </button>
                    <button type="button" onClick={handleSubmitReview} disabled={reviewSubmitting}
                      className="flex-1 rounded-xl bg-brand-500 py-2 text-[13px] font-semibold text-white active:bg-brand-600 disabled:opacity-60">
                      {reviewSubmitting ? "Submitting…" : "Submit review"}
                    </button>
                  </div>
                </div>
              );
            })()}

            {selected.role === "host" && selected.status !== "canceled" ? (
              <button onClick={handleHostCancel} disabled={cancelingHostBooking}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 py-3 text-[13px] font-semibold text-rose-700 active:bg-rose-100 disabled:opacity-60">
                {cancelingHostBooking ? "Canceling…" : "Cancel booking"}
              </button>
            ) : selected.role === "host" && selected.cancellationSource === "host" ? (
              <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
                Booking was canceled by the host. Refund sent where eligible.
              </div>
            ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
