"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMyBookings, type BookingSummary } from "../../lib/api";
import { useAuth } from "../../components/AuthProvider";
import { SlimNav } from "../../components/SlimNav";
import { DashboardShell } from "../../components/DashboardShell";
import { MapPin, Car } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBookingDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getBookingTab(b: BookingSummary): "active" | "upcoming" | "past" {
  const now = new Date();
  const start = new Date(b.startTime);
  const end = new Date(b.endTime);
  if (b.status === "cancelled") return "past";
  if (now >= start && now <= end) return "active";
  if (start > now) return "upcoming";
  return "past";
}

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (s === "cancelled") return { border: "border-l-rose-400", badge: "text-rose-600 bg-rose-50", label: "Cancelled" };
  if (s === "confirmed" || s === "active") return { border: "border-l-emerald-400", badge: "text-emerald-700 bg-emerald-50", label: "Confirmed" };
  if (s === "pending") return { border: "border-l-amber-400", badge: "text-amber-700 bg-amber-50", label: "Pending" };
  if (s === "completed") return { border: "border-l-slate-300", badge: "text-slate-600 bg-slate-100", label: "Completed" };
  return { border: "border-l-slate-300", badge: "text-slate-600 bg-slate-100", label: status };
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = "active" | "upcoming" | "past";

export default function BookingsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");

  useEffect(() => {
    if (!token) return;
    getMyBookings(token)
      .then((data) => setBookings(data.driverBookings ?? []))
      .catch(() => setBookings([]))
      .finally(() => setFetching(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    router.replace("/login?next=/bookings");
    return null;
  }

  const tabBookings = bookings.filter((b) => getBookingTab(b) === tab);

  const TABS: { key: Tab; label: string }[] = [
    { key: "active",   label: "In progress" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past",     label: "Past" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <SlimNav />
      <DashboardShell>
        <div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">Account</p>
            <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-slate-900">My Bookings</h1>

            {/* Tabs */}
            <div className="mt-5 flex gap-6 border-b border-slate-200">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`pb-3 text-[14px] font-semibold transition ${
                    tab === key
                      ? "border-b-2 border-slate-900 text-slate-900"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {label}
                  {key === "active" && bookings.filter((b) => getBookingTab(b) === "active").length > 0 && (
                    <span className="ml-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {bookings.filter((b) => getBookingTab(b) === "active").length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Booking cards */}
            <div className="mt-5 space-y-3">
              {fetching ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
                ))
              ) : tabBookings.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center text-slate-600">
                  <Car className="mb-3 h-10 w-10 text-slate-200" />
                  <p className="text-[15px] font-semibold text-slate-600">No {tab} bookings</p>
                  {tab === "upcoming" && (
                    <Link
                      href="/search"
                      className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-600"
                    >
                      Find parking
                    </Link>
                  )}
                </div>
              ) : (
                tabBookings.map((b) => <BookingCard key={b.id} booking={b} />)
              )}
            </div>
          </div>
        </div>
      </DashboardShell>
    </div>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({ booking: b }: { booking: BookingSummary }) {
  const { border, badge, label } = statusStyle(b.status);
  const amount = (b.amountCents / 100).toFixed(2);

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 border-l-4 ${border} bg-white shadow-sm`}>
      <div className="px-5 py-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-slate-900">{b.title}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-600">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{b.address}</span>
            </p>
            <p className="mt-0.5 text-[11.5px] text-slate-600">Ref: {b.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badge}`}>
              {label}
            </span>
            <span className="text-[14px] font-bold text-slate-900">€{amount}</span>
          </div>
        </div>

        {/* Times */}
        <div className="mt-4 space-y-2">
          {[
            { label: "From",  time: b.startTime },
            { label: "Until", time: b.endTime },
          ].map(({ label: l, time }) => (
            <div key={l} className="flex items-center gap-3">
              <div className="flex w-10 items-center gap-1.5">
                <div className="h-2 w-2 rounded-full border-2 border-slate-300 bg-white" />
                <span className="text-[12px] text-slate-600">{l}</span>
              </div>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[12.5px] font-semibold text-slate-700">
                {formatBookingDate(time)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
