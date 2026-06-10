"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import type { Listing } from "../../../components/ListingCard";

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

type EarningsSummary = {
  totalCents: number;
  feeCents: number;
  netCents: number;
};

function formatAmount(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

function payoutStatusMessage(payout: PayoutStatus): string {
  const isMock = Boolean(payout.accountId?.startsWith("acct_mock_"));
  if (payout.payoutsEnabled) return "Payouts active — transfers arrive automatically.";
  if (isMock) return "Connect Stripe to receive host payouts.";
  if (payout.requirementsDue.length > 0) return "Stripe needs a few more details before payouts can be enabled.";
  if (payout.detailsSubmitted) return "Details submitted — Stripe is reviewing your account.";
  if (payout.accountId) return "Finish payout setup to receive earnings.";
  return "Connect Stripe to receive host payouts.";
}

// ── Live activity derived from host bookings ─────────────────────────────────

type SpaceActivity = {
  current: BookingSummary | null;
  next: BookingSummary | null;
};

function isLive(b: BookingSummary, now: Date) {
  if (b.status !== "confirmed" || b.refundStatus === "refunded") return false;
  const start = new Date(b.startTime);
  const end = new Date(b.endTime);
  return start <= now && now < end;
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

const timeFmt = new Intl.DateTimeFormat("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-IE", { weekday: "short", day: "numeric", month: "short" });

function formatDayTime(date: Date, now: Date): string {
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return timeFmt.format(date);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `tomorrow ${timeFmt.format(date)}`;
  return `${dayFmt.format(date)} ${timeFmt.format(date)}`;
}

function vehicleLabel(b: BookingSummary): string | null {
  const desc = [b.driverVehicleColor, b.driverVehicleMake].filter(Boolean).join(" ");
  const parts = [desc || null, b.vehiclePlate].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function driverShortName(b: BookingSummary): string | null {
  if (!b.driverName) return null;
  const parts = b.driverName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function priceLabel(listing: Listing): string | null {
  if (listing.pricePerMonth) return `€${listing.pricePerMonth}/mo`;
  if (listing.rateType === "hourly" && listing.pricePerHour) return `€${listing.pricePerHour}/hr`;
  if (listing.pricePerDay) return `€${listing.pricePerDay}/day`;
  return null;
}

export default function HostDashboardPage() {
  const { user, token, loading } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [hostBookings, setHostBookings] = useState<BookingSummary[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [payout, setPayout] = useState<PayoutStatus | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const loadAll = async () => {
    if (!token) return;
    setStatus("loading");
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
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Keep occupancy fresh while the page is open
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      getMyBookings(token)
        .then((res) => setHostBookings(res.hostBookings ?? []))
        .catch(() => {});
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
      setDeleteError(err instanceof Error ? err.message : "Could not delete listing");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePayoutSetup = async () => {
    if (!token) return;
    setPayoutBusy(true);
    try {
      const callbackUrl = origin ? `${origin}/host/dashboard` : undefined;
      const res = await createHostPayoutAccount(token, {
        accountId: payout?.accountId ?? undefined,
        returnUrl: callbackUrl,
        refreshUrl: callbackUrl,
      });
      if (res.onboardingUrl) {
        window.location.href = res.onboardingUrl;
        return;
      }
      const refreshed = await getHostPayoutStatus(token);
      setPayout(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payout setup");
    } finally {
      setPayoutBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SlimNav />
        <div className="mx-auto max-w-3xl px-5 py-10">
          <p className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Sign in to continue</p>
          <p className="mt-1 text-[14px] text-slate-600">You need an account to manage your listings.</p>
          <div className="mt-5 flex flex-col gap-3">
            <Link href="/login" className="flex items-center justify-center rounded-2xl bg-brand-500 py-3.5 text-[15px] font-bold text-white">Sign in</Link>
            <Link href="/signup" className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5 text-[15px] font-semibold text-slate-700">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  const created =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("created")
      : null;
  const isMock = Boolean(payout?.accountId?.startsWith("acct_mock_"));

  const now = new Date();
  const activity = groupActivity(hostBookings, now);
  const occupiedCount = listings.filter((l) => activity.get(l.id)?.current).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <SlimNav />
      <div className="mx-auto max-w-3xl px-5 pb-16">

      {/* ── Page header ── */}
      <div className="py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Host</p>
        <h1 className="mt-1 text-[24px] font-bold tracking-[-0.03em] text-slate-900">Your spaces</h1>
      </div>

      {created && (
        <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] font-medium text-brand-700">
          Listing published successfully.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>
      )}

      {/* ── Overview strip: earnings + payouts ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Net earnings</p>
          {earnings ? (
            <>
              <p className="mt-1.5 text-[26px] font-extrabold tracking-tight text-slate-900">{formatAmount(earnings.totalCents)}</p>
              <p className="mt-0.5 text-[12px] font-medium text-emerald-600">0% host fee — you keep everything</p>
            </>
          ) : (
            <p className="mt-1.5 text-[13px] text-slate-500">{status === "loading" ? "Loading…" : "No earnings yet."}</p>
          )}
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Payouts</p>
            {payout?.payoutsEnabled && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            )}
          </div>
          {payout ? (
            <>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{payoutStatusMessage(payout)}</p>
              {payout.requirementsDue.length > 0 && (
                <p className="mt-1 text-[12px] text-slate-500">
                  Missing: {payout.requirementsDue.slice(0, 3).join(", ")}{payout.requirementsDue.length > 3 ? "…" : ""}
                </p>
              )}
              {!payout.payoutsEnabled && (
                <button
                  onClick={handlePayoutSetup}
                  disabled={payoutBusy}
                  className="mt-3 flex w-full items-center justify-center rounded-2xl bg-brand-500 py-2.5 text-[13px] font-bold text-white active:bg-brand-600 disabled:opacity-50"
                >
                  {payoutBusy ? "Opening…" : isMock ? "Create Stripe test account" : payout.accountId ? "Finish payout setup" : "Enable payouts"}
                </button>
              )}
            </>
          ) : (
            <p className="mt-1.5 text-[13px] text-slate-500">{status === "loading" ? "Loading…" : "—"}</p>
          )}
        </div>
      </div>

      {/* ── Spaces ── */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Spaces</h2>
            {listings.length > 0 && (
              <span className="text-[12px] font-medium text-slate-500">
                {occupiedCount} of {listings.length} occupied
              </span>
            )}
          </div>
          <Link
            href="/host"
            className="flex items-center gap-1.5 rounded-full bg-brand-500 px-3.5 py-1.5 text-[12px] font-semibold text-white active:bg-brand-600"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add space
          </Link>
        </div>

        {status === "loading" && listings.length === 0 ? (
          <div className="mt-4 space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="overflow-hidden rounded-3xl bg-white shadow-card">
                <div className="h-40 animate-pulse bg-slate-100" />
                <div className="space-y-2.5 p-5">
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-4 rounded-3xl bg-white px-5 py-10 text-center shadow-card">
            <p className="text-[15px] font-semibold text-slate-700">No spaces yet</p>
            <p className="mt-1 text-[13px] text-slate-600">Add your first space to start taking bookings.</p>
            <Link
              href="/host"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-5 py-2.5 text-[13px] font-semibold text-white"
            >
              Add first space
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {listings.map((listing) => {
              const thumb = listing.imageUrls?.[0] ?? listing.image_urls?.[0] ?? null;
              const act = activity.get(listing.id) ?? { current: null, next: null };
              const price = priceLabel(listing);
              const current = act.current;
              const next = act.next;
              const currentVehicle = current ? vehicleLabel(current) : null;
              const currentDriver = current ? driverShortName(current) : null;

              return (
                <div key={listing.id} className="overflow-hidden rounded-3xl bg-white shadow-card">
                  {/* Photo */}
                  <div className="relative h-40 w-full">
                    {thumb ? (
                      <img src={thumb} alt={listing.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100">
                        <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
                        </svg>
                      </div>
                    )}
                    {price && (
                      <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[12px] font-bold text-slate-900 shadow-sm">
                        {price}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-[16px] font-bold tracking-[-0.02em] text-slate-900">{listing.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-slate-500">{listing.address ? getAreaLabel(listing.address) : ""}</p>
                      </div>

                      {/* Overflow menu */}
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === listing.id ? null : listing.id)}
                          aria-label="More options"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:bg-slate-100"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                          </svg>
                        </button>
                        {menuOpenId === listing.id && (
                          <>
                            <button
                              aria-hidden
                              tabIndex={-1}
                              className="fixed inset-0 z-10 cursor-default"
                              onClick={() => setMenuOpenId(null)}
                            />
                            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 shadow-card">
                              {origin && (
                                <a href={`/qa/${listing.id}/qr`} className="block px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                                  Printable QR
                                </a>
                              )}
                              <button
                                onClick={() => { setConfirmDeleteId(listing.id); setMenuOpenId(null); }}
                                className="block w-full px-4 py-2.5 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50"
                              >
                                Delete space
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Live status */}
                    {current ? (
                      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          </span>
                          <p className="text-[13px] font-bold text-emerald-800">
                            Occupied until {formatDayTime(new Date(current.endTime), now)}
                          </p>
                          <span className="ml-auto text-[13px] font-bold text-emerald-700">{formatAmount(current.amountCents)}</span>
                        </div>
                        {(currentVehicle || currentDriver) && (
                          <p className="mt-1.5 pl-[18px] text-[13px] text-emerald-900/80">
                            {[currentVehicle, currentDriver].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full border-2 border-slate-300" />
                          <p className="text-[13px] font-semibold text-slate-600">Free now</p>
                        </div>
                      </div>
                    )}

                    {/* Next booking */}
                    {next && (
                      <p className="mt-3 text-[13px] text-slate-600">
                        <span className="font-semibold text-slate-700">Next:</span>{" "}
                        {formatDayTime(new Date(next.startTime), now)} – {formatDayTime(new Date(next.endTime), now)}
                        {driverShortName(next) ? ` · ${driverShortName(next)}` : ""}
                      </p>
                    )}

                    {/* Delete confirm */}
                    {confirmDeleteId === listing.id && (
                      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 ring-1 ring-rose-100">
                        <p className="text-[13px] font-medium text-rose-700">Delete this space?</p>
                        {deleteError && <span className="text-[11px] text-rose-600">{deleteError}</span>}
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(listing.id)}
                            disabled={deletingId === listing.id}
                            className="rounded-full bg-rose-600 px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                          >
                            {deletingId === listing.id ? "Deleting…" : "Delete"}
                          </button>
                          <button
                            onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                            className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                      <a
                        href={`/listing/${listing.id}`}
                        className="rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white active:bg-slate-700"
                      >
                        View listing
                      </a>
                      {origin && (
                        <a
                          href={`/qa/${listing.id}`}
                          className="rounded-full px-4 py-2 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200 active:bg-slate-50"
                        >
                          QR portal
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
