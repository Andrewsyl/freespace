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

  if (loading) return <div className="p-4 text-sm text-slate-600">Loading…</div>;

  if (!user) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-700">Sign in to view earnings.</p>
        <div className="flex gap-2 text-sm">
          <Link href="/login" className="btn-primary">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const currency = summary?.currency ?? "EUR";

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand-700">Earnings</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Host payouts</h1>
        <p className="text-sm text-slate-600">Connect Stripe and track what you have earned from confirmed bookings.</p>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-slate-500">Stripe connect</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">{statusLabel(connectStatus)}</p>
              {connectStatus?.accountId && <p className="text-xs text-slate-500">Account: {connectStatus.accountId}</p>}
            </div>
            <StatusPill tone={statusTone(connectStatus)}>{statusLabel(connectStatus)}</StatusPill>
          </div>
          <p className="mt-3 text-sm text-slate-600">{statusMessage(connectStatus)}</p>
          {connectStatus?.requirementsDue?.length ? (
            <p className="mt-2 text-xs text-amber-700">
              Missing: {connectStatus.requirementsDue.slice(0, 3).join(", ")}
              {connectStatus.requirementsDue.length > 3 ? "…" : ""}
            </p>
          ) : null}
          {!connectStatus?.payoutsEnabled && (
            <button
              onClick={handleConnect}
              disabled={linkLoading}
              className="mt-3 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {linkLoading ? "Opening…" : connectStatus?.accountId ? "Finish onboarding" : "Connect Stripe"}
            </button>
          )}
        </div>

        <BalanceCard
          title="Gross earnings"
          amount={summary?.totalCents ?? 0}
          currency={currency}
          tone="success"
        />
        <BalanceCard
          title="Net payout"
          amount={summary?.netCents ?? 0}
          currency={currency}
          tone="muted"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Earnings summary</h2>
            <p className="text-sm text-slate-600">Confirmed bookings less the platform fee.</p>
          </div>

          {status === "loading" && <div className="text-sm text-slate-600">Loading earnings…</div>}

          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Gross bookings" value={formatMoney(summary?.totalCents ?? 0, currency)} />
            <MetricCard label="Platform fees" value={formatMoney(summary?.feeCents ?? 0, currency)} muted />
            <MetricCard label="Net to host" value={formatMoney(summary?.netCents ?? 0, currency)} strong />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
          <div className="grid items-center gap-4 md:grid-cols-[140px_1fr]">
            <div className="mx-auto w-full max-w-[140px]">
              <Image
                src="/illustrations/revenue.svg.png"
                alt="Revenue illustration"
                width={720}
                height={720}
                className="h-auto w-full"
              />
            </div>
            <div className="space-y-2">
              <p className="text-base font-semibold text-slate-900">Payout transfers</p>
              <p className="text-sm text-slate-600">
                Payouts are created automatically once a confirmed booking clears the payout window. Complete Stripe onboarding first so transfers can be sent.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusPill({ children, tone }: { children: string; tone: "success" | "warning" | "danger" }) {
  const tones = {
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-rose-100 text-rose-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function BalanceCard({
  title,
  amount,
  currency,
  tone,
}: {
  title: string;
  amount: number;
  currency: string;
  tone: "success" | "muted";
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-slate-500">{title}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${tone === "success" ? "text-slate-900" : "text-slate-700"}`}>
        {formatMoney(amount, currency)}
      </p>
    </div>
  );
}

function MetricCard({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${strong ? "text-slate-900" : muted ? "text-slate-700" : "text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}
