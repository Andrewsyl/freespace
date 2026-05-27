"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  WalletIcon,
  CreditCardIcon,
  PlusIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import {
  deleteListing,
  getHostListings,
  getHostPayoutStatus,
  getHostEarningsSummary,
  createHostPayoutAccount,
} from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
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
  if (payout.payoutsEnabled) return "Payouts are active. Transfers will arrive automatically.";
  if (isMock) return "This is a local mock payout account. Click below to create a real Stripe test payout account.";
  if (payout.requirementsDue.length > 0) return "Stripe still needs a few details before payouts can be enabled.";
  if (payout.detailsSubmitted) return "Your details were submitted. Stripe is still reviewing the payout account.";
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
    return <div className="text-sm text-slate-600">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Sign in to see your listings.</p>
        <Link href="/login" className="btn-primary w-fit">Go to login</Link>
      </div>
    );
  }

  const created =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("created")
      : null;
  const isMock = Boolean(payout?.accountId?.startsWith("acct_mock_"));

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <header className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-[0.28em] text-emerald-200">Host dashboard</p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">Your listings</h1>
            <p className="text-sm text-emerald-100/80">Manage spaces, payouts, and visibility.</p>
            <div className="flex flex-wrap gap-2 pt-1 text-sm">
              <Link
                href="/host"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 font-semibold text-slate-900 hover:bg-emerald-400"
              >
                <PlusIcon className="h-4 w-4" />
                Add listing
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/15"
              >
                View bookings
              </Link>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[200px] lg:mx-0">
            <Image
              src="/illustrations/parking-alt-02.svg.png"
              alt="Host parking illustration"
              width={720}
              height={720}
              className="h-auto w-full"
            />
          </div>
        </div>
      </header>

      {created && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Listing published successfully.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* ── Stats row: earnings + payout ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Earnings summary */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <WalletIcon className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-900">Earnings summary</p>
          </div>
          {earnings ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total earned</span>
                <span className="font-semibold text-slate-900">{formatAmount(earnings.totalCents)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Platform fee ({PLATFORM_FEE_PCT}%)</span>
                <span className="font-semibold text-slate-900">{formatAmount(earnings.feeCents)}</span>
              </div>
              <p className="text-xs text-slate-400">{PLATFORM_FEE_PCT}% platform fee applied per booking.</p>
              <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-semibold text-slate-900">Net payout</span>
                <span className="text-lg font-bold text-emerald-600">{formatAmount(earnings.netCents)}</span>
              </div>
            </div>
          ) : status === "loading" ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <p className="text-sm text-slate-400">No earnings yet.</p>
          )}
        </div>

        {/* Payout status */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CreditCardIcon className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-900">Payouts</p>
          </div>
          {payout ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{payoutStatusMessage(payout)}</p>
              {payout.requirementsDue.length > 0 && (
                <p className="text-xs text-slate-400">
                  Missing: {payout.requirementsDue.slice(0, 3).join(", ")}
                  {payout.requirementsDue.length > 3 ? "…" : ""}
                </p>
              )}
              {payout.payoutsEnabled ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  Active
                </span>
              ) : (
                <button
                  onClick={handlePayoutSetup}
                  disabled={payoutBusy}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {payoutBusy
                    ? "Opening…"
                    : isMock
                      ? "Create Stripe test account"
                      : payout.accountId
                        ? "Finish payout setup"
                        : "Enable payouts"}
                </button>
              )}
            </div>
          ) : status === "loading" ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : null}
        </div>
      </div>

      {/* ── Host playbook ── */}
      <section className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Host playbook</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">What gets bookings</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { title: "Make access obvious", body: "Add clear arrival notes, gate details, and any code drivers need after booking." },
                { title: "Keep pricing credible", body: "Drivers convert faster when your daily rate is close to nearby spaces and easy to understand." },
                { title: "Use photos that prove the spot", body: "Show the entrance, the bay itself, and anything that helps a driver recognise the space quickly." },
                { title: "Avoid cancellations", body: "Accurate availability and fast support matter more than aggressive pricing once a driver has paid." },
              ].map((tip) => (
                <div key={tip.title} className="rounded-lg border border-emerald-100 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">{tip.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{tip.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-[200px] rounded-lg border border-white/70 bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Quality checklist</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {[
                "Street address pinned correctly",
                "Arrival instructions added",
                "Price reviewed against nearby spaces",
                "Availability reflects real access",
                "Photos show exactly where to park",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Listings ── */}
      {status === "loading" && listings.length === 0 && (
        <p className="text-sm text-slate-500">Loading listings…</p>
      )}

      <div className="grid gap-3">
        {listings.map((listing) => {
          const thumb = listing.imageUrls?.[0] ?? listing.image_urls?.[0] ?? null;
          return (
            <div
              key={listing.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="flex gap-0">
                {/* Thumbnail */}
                <div className="relative h-auto w-28 shrink-0 sm:w-36">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={listing.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-[112px] w-full items-center justify-center bg-slate-100">
                      <BuildingOfficeIcon className="h-8 w-8 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">{listing.title}</h3>
                      <p className="mt-0.5 truncate text-sm text-slate-500">{listing.address}</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        €{listing.pricePerDay} / day
                        {listing.availability ? (
                          <span className="ml-2 font-normal text-slate-500">{listing.availability}</span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(listing.id)}
                      disabled={deletingId === listing.id}
                      className="shrink-0 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {deletingId === listing.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/listing/${listing.id}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View listing
                    </a>
                    {origin && (
                      <>
                        <a
                          href={`/qa/${listing.id}`}
                          className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          QR portal
                        </a>
                        <a
                          href={`/qa/${listing.id}/qr`}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Printable QR
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* QR code strip (inline, below) */}
              {origin && (
                <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(`${origin}/qa/${listing.id}`)}`}
                    alt={`QR for ${listing.title}`}
                    className="h-14 w-14 rounded-lg border border-slate-200 bg-white p-0.5"
                  />
                  <p className="break-all text-[11px] text-slate-400">{origin}/qa/{listing.id}</p>
                </div>
              )}
            </div>
          );
        })}

        {status === "idle" && listings.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 shadow-sm">
            <div className="grid items-center gap-4 md:grid-cols-[180px_1fr]">
              <div className="mx-auto w-full max-w-[180px]">
                <Image
                  src="/illustrations/parking-alt-01.svg.png"
                  alt="No listings illustration"
                  width={720}
                  height={720}
                  className="h-auto w-full"
                />
              </div>
              <div className="space-y-3 text-center md:text-left">
                <p className="text-lg font-semibold text-slate-900">No listings yet</p>
                <p className="text-sm text-slate-600">
                  Add your first space to start taking bookings, generating QR check-in links, and earning payouts.
                </p>
                <Link
                  href="/host"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add first listing
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
