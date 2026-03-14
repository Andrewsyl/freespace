"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { getAdminDashboard, type AdminMetrics } from "../../../lib/api";

const formatCurrency = (cents: number) => {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(value);
};

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getAdminDashboard(token)
      .then(setMetrics)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load metrics"));
  }, [token]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl tracking-tight font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Marketplace snapshot for the last 30 days.</p>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics?.userCount ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listings</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics?.listingCount ?? "—"}</p>
          <p className="text-xs text-slate-500">Active: {metrics?.activeListingCount ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bookings (30d)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics?.bookings30d ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GMV (30d)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {metrics ? formatCurrency(metrics.gmv30dCents) : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payout backlog</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics?.payoutBacklog ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
