"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createHostPayoutAccount, getHostEarningsSummary, getHostPayoutStatus } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";

type LoadingState = "idle" | "loading" | "error";

type HostEarningsSummary = {
  totalCents: number;
  feeCents: number;
  netCents: number;
  currency: string;
};

type HostPayoutStatus = {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
};

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  const normalized = (currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: normalized }).format(value);
  } catch {
    return `€${value.toFixed(2)}`;
  }
}

function statusTone(status: HostPayoutStatus | null) {
  if (!status) return "warning";
  if (status.payoutsEnabled) return "success";
  if (status.requirementsDue.length > 0 || status.accountId) return "warning";
  return "warning";
}

function statusLabel(status: HostPayoutStatus | null) {
  if (!status) return "Action needed";
  if (status.payoutsEnabled) return "Active";
  if (status.detailsSubmitted) return "Under review";
  return "Action needed";
}

function statusMessage(status: HostPayoutStatus | null) {
  if (!status) return "Connect Stripe to receive host payouts.";
  if (status.payoutsEnabled) return "Payouts are active. Eligible earnings will transfer automatically.";
  if (status.requirementsDue.length > 0) {
    return "Stripe still needs a few details before payouts can be enabled.";
  }
  if (status.detailsSubmitted) {
    return "Your details were submitted. Stripe is reviewing the account.";
  }
  if (status.accountId) {
    return "Finish Stripe onboarding to receive host payouts.";
  }
  return "Connect Stripe to receive host payouts.";
}

export default function EarningsPage() {
  const { user, token, loading } = useAuth();
  const [connectStatus, setConnectStatus] = useState<HostPayoutStatus | null>(null);
  const [summary, setSummary] = useState<HostEarningsSummary | null>(null);
  const [status, setStatus] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const loadData = useMemo(
    () => async () => {
      if (!token) return;
      setStatus("loading");
      setError(null);
      try {
        const [payout, earnings] = await Promise.all([
          getHostPayoutStatus(token),
          getHostEarningsSummary(token),
        ]);
        setConnectStatus(payout);
        setSummary(earnings);
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not load host earnings");
      }
    },
    [token]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleConnect = async () => {
    if (!token) return;
    setLinkLoading(true);
    setError(null);
    try {
      const base = typeof window !== "undefined" ? `${window.location.origin}/dashboard/earnings` : undefined;
      const data = await createHostPayoutAccount(token, {
        accountId: connectStatus?.accountId ?? undefined,
        returnUrl: base,
        refreshUrl: base,
      });
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
        return;
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payout onboarding");
    } finally {
      setLinkLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>;

  if (!user) {
    return (
      <div className="py-4">
        <p className="text-[14px] text-slate-600">Sign in to view earnings.</p>
        <div className="mt-4 flex flex-col gap-3">
          <Link href="/login" className="flex h-12 items-center justify-center rounded-xl bg-brand-500 text-[15px] font-bold text-white">Sign in</Link>
          <Link href="/signup" className="flex h-12 items-center justify-center rounded-xl border border-slate-200 text-[15px] font-semibold text-slate-700">Create account</Link>
        </div>
      </div>
    );
  }

  const currency = summary?.currency ?? "EUR";

  return (
    <div className="space-y-4">
      <div className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500">Hosting</p>
        <h1 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] text-slate-900">Your earnings</h1>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-slate-600">What you&apos;ve earned from hosting, and where your payouts stand.</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}

      {/* Earnings — signature dark anchor surface (homepage slab vocabulary) */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 px-6 py-7 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.5)] sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-400">Net earnings</p>
          <p className="mt-2 font-display text-[44px] font-extrabold leading-none tracking-[-0.03em] text-white">
            {formatMoney(summary?.netCents ?? 0, currency)}
          </p>
          <p className="mt-3 text-[13px] leading-[1.6] text-slate-400">Transferred to your bank automatically via Stripe, after fees.</p>
          <div className="mt-6 flex gap-3">
            <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Gross</p>
              <p className="mt-1 text-[17px] font-extrabold tracking-tight text-white">{formatMoney(summary?.totalCents ?? 0, currency)}</p>
            </div>
            <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Platform fees</p>
              <p className="mt-1 text-[17px] font-extrabold tracking-tight text-slate-300">{formatMoney(summary?.feeCents ?? 0, currency)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stripe payouts card */}
      <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(15,23,42,0.16)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-slate-900">Stripe payouts</h2>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            connectStatus?.payoutsEnabled ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"
          }`}>{statusLabel(connectStatus)}</span>
        </div>
        <p className="mt-2 text-[13.5px] leading-6 text-slate-600">{statusMessage(connectStatus)}</p>
        {connectStatus?.requirementsDue?.length ? (
          <p className="mt-1 text-[12px] text-amber-600">
            Missing: {connectStatus.requirementsDue.slice(0, 3).join(", ")}{connectStatus.requirementsDue.length > 3 ? "…" : ""}
          </p>
        ) : null}
        {!connectStatus?.payoutsEnabled && (
          <button onClick={handleConnect} disabled={linkLoading}
            className="mt-4 rounded-xl bg-brand-500 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {linkLoading ? "Opening…" : connectStatus?.accountId ? "Finish onboarding" : "Connect Stripe"}
          </button>
        )}
      </div>

      {/* How payouts work */}
      <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(15,23,42,0.16)]">
        <h2 className="text-[16px] font-bold text-slate-900">How payouts work</h2>
        <p className="mt-2 text-[13.5px] leading-6 text-slate-600">
          Payouts are created automatically once a confirmed booking clears the payout window. Complete Stripe onboarding first so transfers can be sent to your bank account.
        </p>
      </div>
    </div>
  );
}
