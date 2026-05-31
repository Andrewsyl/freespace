"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteListing,
  getHostListings,
  getHostPayoutStatus,
  getHostEarningsSummary,
  createHostPayoutAccount,
} from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { SlimNav } from "../../../components/SlimNav";
import type { Listing } from "../../../components/ListingCard";

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

const PLATFORM_FEE_PCT = 10;

function formatAmount(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

function payoutStatusMessage(payout: PayoutStatus): string {
  const isMock = Boolean(payout.accountId?.startsWith("acct_mock_"));
  if (payout.payoutsEnabled) return "Payouts active — transfers arrive automatically.";
  if (isMock) return "Local mock account. Create a real Stripe test account to continue.";
  if (payout.requirementsDue.length > 0) return "Stripe needs a few more details before payouts can be enabled.";
  if (payout.detailsSubmitted) return "Details submitted — Stripe is reviewing your account.";
  if (payout.accountId) return "Finish payout setup to receive earnings.";
  return "Connect Stripe to receive host payouts.";
}

export default function HostDashboardPage() {
  const { user, token, loading } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [payout, setPayout] = useState<PayoutStatus | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const loadAll = async () => {
    if (!token) return;
    setStatus("loading");
    setError(null);
    try {
      const [listingsRes, earningsRes, payoutRes] = await Promise.all([
        getHostListings(token),
        getHostEarningsSummary(token).catch(() => null),
        getHostPayoutStatus(token).catch(() => null),
      ]);
      setListings(listingsRes?.listings ?? []);
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

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm("Delete this listing?")) return;
    setDeletingId(id);
    try {
      await deleteListing(id, token);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete listing");
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
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <SlimNav />
        <div className="px-5 py-10">
          <p className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Sign in to continue</p>
          <p className="mt-1 text-[14px] text-slate-500">You need an account to manage your listings.</p>
          <div className="mt-5 flex flex-col gap-3">
            <Link href="/login" className="flex items-center justify-center rounded-2xl bg-brand-500 py-3.5 text-[15px] font-bold text-white">Sign in</Link>
            <Link href="/signup" className="flex items-center justify-center rounded-2xl border border-slate-200 py-3.5 text-[15px] font-semibold text-slate-700">Create account</Link>
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

  return (
    <div className="min-h-screen bg-white">
      <SlimNav />

      {/* ── Page header ── */}
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Host</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Your listings</h1>
      </div>

      {created && (
        <div className="mx-5 mt-4 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] font-medium text-brand-700">
          Listing published successfully.
        </div>
      )}
      {error && (
        <div className="mx-5 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>
      )}

      {/* ── Earnings ── */}
      <section className="border-b border-slate-200 px-5 py-6">
        <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Earnings</h2>
        {earnings ? (
          <div className="mt-4 divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-[13px] text-slate-500">Total earned</span>
              <span className="text-[13px] font-semibold text-slate-900">{formatAmount(earnings.totalCents)}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-[13px] text-slate-500">Platform fee ({PLATFORM_FEE_PCT}%)</span>
              <span className="text-[13px] font-semibold text-slate-900">{formatAmount(earnings.feeCents)}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-[14px] font-bold text-slate-900">Net payout</span>
              <span className="text-[18px] font-extrabold tracking-tight text-brand-600">{formatAmount(earnings.netCents)}</span>
            </div>
          </div>
        ) : status === "loading" ? (
          <p className="mt-3 text-[13px] text-slate-400">Loading…</p>
        ) : (
          <p className="mt-3 text-[13px] text-slate-400">No earnings yet.</p>
        )}
      </section>

      {/* ── Payouts ── */}
      <section className="border-b border-slate-200 px-5 py-6">
        <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Payouts</h2>
        {payout ? (
          <div className="mt-3 space-y-3">
            <p className="text-[14px] leading-6 text-slate-600">{payoutStatusMessage(payout)}</p>
            {payout.requirementsDue.length > 0 && (
              <p className="text-[12px] text-slate-400">
                Missing: {payout.requirementsDue.slice(0, 3).join(", ")}{payout.requirementsDue.length > 3 ? "…" : ""}
              </p>
            )}
            {payout.payoutsEnabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700 ring-1 ring-brand-200">
                Active
              </span>
            ) : (
              <button
                onClick={handlePayoutSetup}
                disabled={payoutBusy}
                className="flex w-full items-center justify-center rounded-2xl bg-brand-500 py-3.5 text-[15px] font-bold text-white active:bg-brand-600 disabled:opacity-50"
              >
                {payoutBusy ? "Opening…" : isMock ? "Create Stripe test account" : payout.accountId ? "Finish payout setup" : "Enable payouts"}
              </button>
            )}
          </div>
        ) : status === "loading" ? (
          <p className="mt-3 text-[13px] text-slate-400">Loading…</p>
        ) : null}
      </section>

      {/* ── Listings ── */}
      <section className="px-5 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Spaces</h2>
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
          <p className="mt-4 text-[13px] text-slate-400">Loading…</p>
        ) : listings.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-[15px] font-semibold text-slate-700">No spaces yet</p>
            <p className="mt-1 text-[13px] text-slate-400">Add your first space to start taking bookings.</p>
            <Link
              href="/host"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-5 py-2.5 text-[13px] font-semibold text-white"
            >
              Add first space
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {listings.map((listing) => {
              const thumb = listing.imageUrls?.[0] ?? listing.image_urls?.[0] ?? null;
              return (
                <div key={listing.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex gap-0">
                    {/* Thumbnail */}
                    <div className="relative h-auto w-28 shrink-0">
                      {thumb ? (
                        <img src={thumb} alt={listing.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full min-h-[100px] w-full items-center justify-center bg-slate-100">
                          <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col gap-2.5 p-3.5">
                      <div>
                        <p className="line-clamp-1 text-[14px] font-bold text-slate-900">{listing.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-slate-400">{listing.address}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={`/listing/${listing.id}`} className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 active:bg-slate-50">
                          View listing
                        </a>
                        {origin && (
                          <>
                            <a href={`/qa/${listing.id}`} className="rounded-full border border-brand-200 px-3 py-1 text-[11px] font-semibold text-brand-700 active:bg-brand-50">
                              QR portal
                            </a>
                            <a href={`/qa/${listing.id}/qr`} className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 active:bg-slate-50">
                              Printable QR
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(listing.id)}
                          disabled={deletingId === listing.id}
                          className="ml-auto rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 active:bg-rose-50 disabled:opacity-50"
                        >
                          {deletingId === listing.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* QR strip */}
                  {origin && (
                    <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(`${origin}/qa/${listing.id}`)}`}
                        alt={`QR for ${listing.title}`}
                        className="h-12 w-12 rounded-xl border border-slate-200 bg-white p-0.5"
                      />
                      <p className="break-all text-[11px] text-slate-400">{origin}/qa/{listing.id}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
