"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookingCard, type Booking } from "../../components/BookingCard";
import { cancelHostBooking, getMyBookings, createReview } from "../../lib/api";
import { useAuth } from "../../components/AuthProvider";

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
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
              driver: undefined,
              status: (b.status as Booking["status"]) ?? "pending",
              listingId: b.listingId,
              refundStatus: b.refundStatus,
              refundedAt: b.refundedAt,
              noShowAt: b.noShowAt,
              cancellationSource: b.cancellationSource ?? null,
              startTime: b.startTime,
              endTime: b.endTime,
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
      <div className="px-5 py-10">
        <p className="text-[14px] text-slate-600">Sign in to view your bookings.</p>
        <div className="mt-4 flex flex-col gap-3">
          <Link href="/login" className="flex h-12 items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white">Sign in</Link>
          <Link href="/signup" className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 text-[15px] font-semibold text-slate-700">Create account</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Dashboard</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
      </div>

      {/* Quick nav */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 px-5 py-3">
        {[
          { href: "/dashboard/payments", label: "Payments" },
          { href: "/dashboard/earnings", label: "Earnings" },
          { href: "/dashboard/favorites", label: "Favourites" },
          { href: "/host", label: "+ List a space" },
        ].map(({ href, label }) => (
          <Link key={href} href={href as any}
            className="shrink-0 rounded-full border border-slate-200 px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 active:bg-slate-50 last:border-brand-200 last:text-brand-700 last:bg-brand-50">
            {label}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200">
        <div className="flex flex-col justify-center px-4 py-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Trips</p>
          <p className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">{stats.driverCount}</p>
        </div>
        <div className="flex flex-col justify-center px-4 py-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Earnings</p>
          <p className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-brand-600">€{stats.hostEarnings.toFixed(0)}</p>
        </div>
        <div className="flex flex-col justify-center px-4 py-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Payouts</p>
          <p className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">{stats.hostCount}</p>
        </div>
      </div>

      {error && <div className="mx-5 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}

      {/* Driver bookings */}
      <section className="border-b border-slate-200 px-5 py-5">
        <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Your trips</h2>

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
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
            <p className="text-[14px] font-semibold text-slate-700">No bookings yet</p>
            <p className="mt-1 text-[13px] text-slate-600">Search for a space to make your first booking.</p>
            <Link href="/" className="mt-3 inline-flex items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-[13px] font-semibold text-white">Find a space</Link>
          </div>
        )}
      </section>

      {/* Host bookings */}
      <section className="px-5 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Host payouts</h2>
          {hostBookings.length > 0 && (
            <span className="text-[12px] font-medium text-slate-600">{hostBookings.length} total</span>
          )}
        </div>
        {hostBookings.length === 0 && status === "idle" ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-[14px] font-semibold text-slate-700">No host bookings yet</p>
            <p className="mt-1 text-[13px] text-slate-600">List a space to start earning.</p>
            <Link href="/host" className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-[13px] font-semibold text-white">List a space</Link>
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
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[15px] font-bold text-slate-900">{selected.title ?? selected.address}</p>
                  <p className="mt-0.5 text-[13px] text-slate-600">{selected.date} · {selected.timeRange}</p>
                </div>
                <button onClick={() => setSelected(null)} className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-600 active:bg-slate-50">
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
            <p className="text-[13px] text-slate-600">Driver: {selected.driver ?? "You"}</p>
            {selected.noShowAt ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                This booking has been marked as a no-show.
              </div>
            ) : null}

            {/* Leave a review — shown for driver (confirmed, ended) bookings */}
            {(() => {
              const isDriverBooking = !selected.driver || selected.driver === user?.email;
              const isConfirmed = selected.status === "confirmed";
              const isEnded = selected.endTime ? new Date(selected.endTime) <= new Date() : false;
              const alreadyReviewed = reviewDone === selected.id;
              if (!isDriverBooking || !isConfirmed || !isEnded) return null;
              if (alreadyReviewed) {
                return (
                  <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
                    ✓ Review submitted — thank you!
                  </div>
                );
              }
              if (!reviewMode) {
                return (
                  <button type="button" onClick={() => setReviewMode(true)}
                    className="w-full rounded-2xl border border-amber-200 bg-amber-50 py-3 text-[13px] font-semibold text-amber-800 active:bg-amber-100">
                    ★ Leave a review
                  </button>
                );
              }
              return (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
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
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-800 focus:border-brand-500 focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setReviewMode(false)}
                      className="rounded-2xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 active:bg-slate-50">
                      Cancel
                    </button>
                    <button type="button" onClick={handleSubmitReview} disabled={reviewSubmitting}
                      className="flex-1 rounded-2xl bg-brand-500 py-2 text-[13px] font-semibold text-white active:bg-brand-600 disabled:opacity-60">
                      {reviewSubmitting ? "Submitting…" : "Submit review"}
                    </button>
                  </div>
                </div>
              );
            })()}

            {selected.status !== "canceled" ? (
              <button onClick={handleHostCancel} disabled={cancelingHostBooking}
                className="w-full rounded-2xl border border-rose-200 bg-rose-50 py-3 text-[13px] font-semibold text-rose-700 active:bg-rose-100 disabled:opacity-60">
                {cancelingHostBooking ? "Canceling…" : "Cancel booking"}
              </button>
            ) : selected.cancellationSource === "host" ? (
              <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
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
