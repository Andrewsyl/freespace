"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  deleteListing,
  getHostListings,
  getHostPayoutStatus,
  getHostEarningsSummary,
  createHostPayoutAccount,
  getMyBookings,
  type BookingSummary,
} from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { SlimNav } from "../../../components/SlimNav";
import {
  Plus,
  MapPin,
  Eye,
  QrCode,
  Trash2,
  LayoutGrid,
  ChevronRight,
  AlertCircle,
  Car,
  Clock,
  Pencil,
  Link2,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import type { Listing } from "../../../components/ListingCard";

// ── Formatters ────────────────────────────────────────────────────────────────

const timeFmt       = new Intl.DateTimeFormat("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt        = new Intl.DateTimeFormat("en-IE", { weekday: "short", day: "numeric", month: "short" });
const headerDateFmt = new Intl.DateTimeFormat("en-IE", { weekday: "long", day: "numeric", month: "long" });

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAreaLabel(address: string): string {
  const isPostcode = (s: string) => /^(Dublin\s*\d+|[A-Z]\d{2}\s*[A-Z0-9]{4})$/i.test(s);
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const trimmed = [...parts];
  while (trimmed.length > 1 && isPostcode(trimmed[trimmed.length - 1])) trimmed.pop();
  const first = trimmed[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
  return [first || trimmed[0], ...trimmed.slice(1)].join(", ");
}

type PayoutStatus = {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
};
type EarningsSummary = { totalCents: number; feeCents: number; netCents: number };

function fmt(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

type SpaceActivity = { current: BookingSummary | null; next: BookingSummary | null };

function isLive(b: BookingSummary, now: Date) {
  if (b.status !== "confirmed" || b.refundStatus === "refunded") return false;
  return new Date(b.startTime) <= now && now < new Date(b.endTime);
}

function isUpcoming(b: BookingSummary, now: Date) {
  if (b.status !== "confirmed" || b.refundStatus === "refunded") return false;
  return new Date(b.startTime) > now;
}

function groupActivity(bookings: BookingSummary[], now: Date): Map<string, SpaceActivity> {
  const map = new Map<string, SpaceActivity>();
  for (const b of bookings) {
    if (!b.listingId) continue;
    const entry = map.get(b.listingId) ?? { current: null, next: null };
    if (isLive(b, now)) {
      if (!entry.current || new Date(b.endTime) > new Date(entry.current.endTime)) entry.current = b;
    } else if (isUpcoming(b, now)) {
      if (!entry.next || new Date(b.startTime) < new Date(entry.next.startTime)) entry.next = b;
    }
    map.set(b.listingId, entry);
  }
  return map;
}

function formatWhen(date: Date, now: Date): string {
  if (date.toDateString() === now.toDateString()) return `Today · ${timeFmt.format(date)}`;
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${timeFmt.format(date)}`;
  return `${dayFmt.format(date)} · ${timeFmt.format(date)}`;
}

function vehicleLabel(b: BookingSummary): string | null {
  const desc = [b.driverVehicleColor, b.driverVehicleMake].filter(Boolean).join(" ");
  return [desc || null, b.vehiclePlate].filter(Boolean).join(" · ") || null;
}

function shortName(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function priceLabel(listing: Listing): string | null {
  if (listing.pricePerMonth) return `€${listing.pricePerMonth}/mo`;
  if (listing.rateType === "hourly" && listing.pricePerHour) return `€${listing.pricePerHour}/hr`;
  if (listing.pricePerDay) return `€${listing.pricePerDay}/day`;
  return null;
}

function greetingWord(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstNameOf(name: string | null | undefined): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0];
}

// ── Space card ────────────────────────────────────────────────────────────────

interface SpaceCardProps {
  listing: Listing;
  act: SpaceActivity;
  now: Date;
  origin: string;
  confirmDeleteId: string | null;
  deleteError: string | null;
  deletingId: string | null;
  onConfirmDelete: (id: string | null) => void;
  onDelete: (id: string) => void;
  hero?: boolean;
}

function SpaceCard({
  listing, act, now, origin,
  confirmDeleteId, deleteError, deletingId,
  onConfirmDelete, onDelete,
  hero = false,
}: SpaceCardProps) {
  const { current, next } = act;
  const thumb = listing.imageUrls?.[0] ?? listing.image_urls?.[0] ?? null;
  const price = priceLabel(listing);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
    navigator.clipboard.writeText(`${base}/listing/${listing.id}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  };

  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">

      {/* ── Status strip ── */}
      {current ? (
        <div className="flex items-center justify-between gap-3 bg-emerald-500 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute h-full w-full animate-ping rounded-full bg-white/60" />
              <span className="relative h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="text-[12.5px] font-bold text-white">Occupied</span>
            <span className="text-white/60">·</span>
            <span className="truncate text-[12.5px] font-medium text-white/90">
              {shortName(current.driverName) ?? "Driver"}
            </span>
          </div>
          <span className="shrink-0 text-[12px] font-medium text-white/80">
            Leaves {formatWhen(new Date(current.endTime), now)}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[12.5px] font-semibold text-slate-700">Available now</span>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 transition hover:text-brand-600"
          >
            <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
            {copied ? "Copied!" : "Share link"}
          </button>
        </div>
      )}

      {/* ── Photo ── */}
      <div className={`relative w-full overflow-hidden bg-slate-100 ${hero ? "h-56 sm:h-64 lg:h-72" : "h-44"}`}>
        {thumb ? (
          <Image
            src={thumb}
            alt={listing.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            sizes={hero ? "(max-width: 768px) 100vw, 672px" : "(max-width: 640px) 100vw, 50vw"}
            priority={hero}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <LayoutGrid className="h-10 w-10 text-slate-200" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

        {price && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-slate-900 shadow-sm">
            {price}
          </span>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3.5">
          <p className={`line-clamp-1 font-bold text-white ${hero ? "text-[17px]" : "text-[14px]"}`}>{listing.title}</p>
          {listing.address && (
            <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-white/70">
              <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} />
              <span className="truncate">{getAreaLabel(listing.address)}</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Current booking details ── */}
      {current && (
        <div className="border-b border-emerald-100 bg-emerald-50/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {vehicleLabel(current) && (
                <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
                  <Car className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                  {vehicleLabel(current)}
                </p>
              )}
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-emerald-700">
                <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                Leaving {formatWhen(new Date(current.endTime), now)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`font-extrabold tracking-tight text-slate-900 ${hero ? "text-[22px]" : "text-[18px]"}`}>
                {fmt(current.amountCents)}
              </p>
              <p className="text-[11px] font-medium text-emerald-700">this booking</p>
            </div>
          </div>
        </div>
      )}

      {/* ── No upcoming bookings nudge ── */}
      {!current && !next && (
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-[12.5px] text-slate-400">No upcoming bookings</p>
        </div>
      )}

      {/* ── Next booking ── */}
      {next && (
        <div className="border-b border-slate-100 px-5 py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Next booking</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-600">
              {shortName(next.driverName)?.charAt(0) ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-slate-800">{shortName(next.driverName) ?? "Driver"}</p>
              {vehicleLabel(next) && (
                <p className="text-[12px] text-slate-400">{vehicleLabel(next)}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12.5px] font-semibold text-slate-700">{formatWhen(new Date(next.startTime), now)}</p>
              <p className="text-[12px] text-slate-400">{fmt(next.amountCents)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmDeleteId === listing.id && (
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-3.5">
          <p className="text-[13.5px] font-semibold text-rose-800">Permanently delete this space?</p>
          {deleteError && <p className="mt-0.5 text-[12px] text-rose-600">{deleteError}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onDelete(listing.id)}
              disabled={deletingId === listing.id}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {deletingId === listing.id && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              Delete
            </button>
            <button
              onClick={() => onConfirmDelete(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center divide-x divide-slate-100">
        <Link
          href={`/listing/${listing.id}` as any}
          className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[12.5px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
          View
        </Link>
        <Link
          href={`/host/edit/${listing.id}` as any}
          className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[12.5px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          Edit
        </Link>
        {origin && (
          <a
            href={`/qa/${listing.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[12.5px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            <QrCode className="h-3.5 w-3.5" strokeWidth={2} />
            QR
          </a>
        )}
        <button
          onClick={() => onConfirmDelete(confirmDeleteId === listing.id ? null : listing.id)}
          className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[12.5px] font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, href, icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  icon?: React.ElementType;
}) {
  const inner = (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-500 sm:text-[12px]">{label}</p>
        {href && <ArrowUpRight className="h-4 w-4 text-slate-300" strokeWidth={2} />}
        {!href && Icon && (
          <div className="hidden h-8 w-8 items-center justify-center rounded-lg bg-slate-50 sm:flex">
            <Icon className="h-4 w-4 text-slate-400" strokeWidth={2} />
          </div>
        )}
      </div>
      <div>
        <p className="mt-2 text-[22px] font-extrabold tracking-[-0.03em] text-slate-950 sm:mt-3 sm:text-[28px]">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-slate-400 sm:text-[12px]">{sub}</p>}
      </div>
    </div>
  );
  if (href) return <Link href={href as any} className="block">{inner}</Link>;
  return inner;
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function HostDashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading || user) return;
    router.replace(`/login?next=${encodeURIComponent("/host/dashboard")}`);
  }, [loading, user, router]);
  const [listings, setListings]             = useState<Listing[]>([]);
  const [hostBookings, setHostBookings]     = useState<BookingSummary[]>([]);
  const [earnings, setEarnings]             = useState<EarningsSummary | null>(null);
  const [payout, setPayout]                 = useState<PayoutStatus | null>(null);
  const [dataLoading, setDataLoading]       = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [payoutBusy, setPayoutBusy]         = useState(false);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError]       = useState<string | null>(null);
  const [origin, setOrigin]                 = useState("");

  const loadAll = async () => {
    if (!token) return;
    setDataLoading(true);
    setError(null);
    try {
      const [listingsRes, bookingsRes, earningsRes, payoutRes] = await Promise.all([
        getHostListings(token),
        getMyBookings(token).catch(() => null),
        getHostEarningsSummary(token).catch(() => null),
        getHostPayoutStatus(token).catch(() => null),
      ]);
      setListings(listingsRes?.listings ?? []);
      setHostBookings(bookingsRes?.hostBookings ?? []);
      setEarnings(earningsRes);
      setPayout(payoutRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      getMyBookings(token).then((r) => setHostBookings(r.hostBookings ?? [])).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [token]);

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteListing(id, token);
      setListings((prev) => prev.filter((l) => l.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePayoutSetup = async () => {
    if (!token) return;
    setPayoutBusy(true);
    try {
      const cb = origin ? `${origin}/host/dashboard` : undefined;
      const res = await createHostPayoutAccount(token, {
        accountId: payout?.accountId ?? undefined,
        returnUrl: cb,
        refreshUrl: cb,
      });
      if (res.onboardingUrl) { window.location.href = res.onboardingUrl; return; }
      setPayout(await getHostPayoutStatus(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payout setup");
    } finally {
      setPayoutBusy(false);
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const created = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("created")
    : null;
  const payoutsNeeded = payout && !payout.payoutsEnabled;

  const now = new Date();
  const activity = groupActivity(hostBookings, now);
  const isSingleSpace = listings.length === 1;

  const upcomingBookings = hostBookings
    .filter((b) => isUpcoming(b, now))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 8);

  const todayArrivals = hostBookings.filter((b) =>
    b.status === "confirmed" &&
    b.refundStatus !== "refunded" &&
    new Date(b.startTime).toDateString() === now.toDateString()
  );

  const spaceCardProps = {
    now, origin, confirmDeleteId, deleteError, deletingId,
    onConfirmDelete: setConfirmDeleteId,
    onDelete: handleDelete,
  };

  return (
    <div className="min-h-screen bg-white">
      <SlimNav />

      <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">

        {/* ── Greeting header ── */}
        <div className="flex items-end justify-between border-b border-slate-100 py-8">
          <div>
            <p className="text-[13px] text-slate-400">{headerDateFmt.format(now)}</p>
            <h1 className="mt-1 text-[30px] font-bold tracking-[-0.03em] text-slate-950">
              {greetingWord(now)}, {firstNameOf(user.name)}
            </h1>
          </div>
          <Link
            href="/host"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            New space
          </Link>
        </div>

        {/* ── Banners ── */}
        {payoutsNeeded && (
          <div className="mt-5 flex gap-3.5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <AlertCircle className="h-4 w-4 text-amber-600" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-amber-900">Set up payouts to get paid</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-amber-700">
                {payout?.detailsSubmitted
                  ? "Your account is under review — no action needed right now."
                  : "Connect your bank account and we'll transfer earnings automatically."}
              </p>
              {!payout?.detailsSubmitted && (
                <button
                  onClick={handlePayoutSetup}
                  disabled={payoutBusy}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {payoutBusy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                  {payout?.accountId ? "Finish setup" : "Set up payouts"}
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        )}
        {created && (
          <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-3 text-[13px] font-medium text-brand-700">
            Your space is live — drivers can now find and book it.
          </div>
        )}
        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-[13px] text-rose-700">{error}</div>
        )}

        {/* ── Loading state ── */}
        {dataLoading ? (
          <div className="mt-8 space-y-5">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 sm:h-28" />)}
            </div>
            <div className="h-10 w-32 animate-pulse rounded-full bg-slate-100" />
            <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
          </div>

        ) : listings.length === 0 ? (

          /* ── Empty state ── */
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
              <LayoutGrid className="h-7 w-7 text-slate-300" strokeWidth={1.5} />
            </div>
            <p className="text-[20px] font-bold tracking-[-0.02em] text-slate-900">List your first space</p>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
              Got a driveway, garage, or car park?<br />Start earning in under 5 minutes.
            </p>
            <Link
              href="/host"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-[14px] font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Get started
            </Link>
          </div>

        ) : (

          /* ── Main content ── */
          <div className="mt-8">

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <StatCard
                  label="Upcoming"
                  value={upcomingBookings.length}
                  sub={upcomingBookings.length === 1 ? "booking" : "bookings"}
                  icon={CalendarDays}
                />
                <StatCard
                  label="Net earnings"
                  value={earnings ? fmt(earnings.netCents) : "—"}
                  sub="lifetime"
                  href="/dashboard/earnings"
                />
                <StatCard
                  label="Active spaces"
                  value={listings.length}
                  sub={listings.length === 1 ? "listing" : "listings"}
                  icon={LayoutGrid}
                />
              </div>

              {/* Today's arrivals */}
              {todayArrivals.length > 0 && (
                <section className="mt-8">
                  <div className="mb-4 flex items-center gap-2">
                    <h2 className="text-[18px] font-bold text-slate-900">Today</h2>
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">
                      {todayArrivals.length} {todayArrivals.length === 1 ? "booking" : "bookings"}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {todayArrivals.map((b) => (
                      <div key={b.id} className="flex items-center gap-4 px-5 py-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[14px] font-bold text-brand-700">
                          {shortName(b.driverName)?.charAt(0) ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-slate-900">
                            {shortName(b.driverName) ?? "Driver"}
                          </p>
                          <p className="text-[12.5px] text-slate-500">
                            {timeFmt.format(new Date(b.startTime))} → {timeFmt.format(new Date(b.endTime))}
                            {vehicleLabel(b) && ` · ${vehicleLabel(b)}`}
                          </p>
                        </div>
                        <p className="shrink-0 text-[14px] font-bold text-slate-900">{fmt(b.amountCents)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Your spaces */}
              <section className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[18px] font-bold text-slate-900">Your spaces</h2>
                  <Link
                    href="/host"
                    className="flex items-center gap-1 text-[13px] font-semibold text-slate-400 transition hover:text-brand-600"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Add space
                  </Link>
                </div>
                <div className={isSingleSpace ? "" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
                  {listings.map((listing) => (
                    <SpaceCard
                      key={listing.id}
                      listing={listing}
                      act={activity.get(listing.id) ?? { current: null, next: null }}
                      hero={isSingleSpace}
                      {...spaceCardProps}
                    />
                  ))}
                </div>
              </section>

          </div>
        )}

      </div>
    </div>
  );
}
