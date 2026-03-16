"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useAuth } from "../../../components/AuthProvider";
import { getAdminDashboard, type AdminMetrics } from "../../../lib/api";

const formatCurrency = (cents: number) => {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(value);
};

const formatShortDate = (value: string) => {
  try {
    return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return value;
  }
};

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalBookings = metrics?.bookingsDaily?.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const totalGmvCents = metrics?.bookingsDaily?.reduce((sum, d) => sum + d.gmvCents, 0) ?? 0;
  const dayCount = metrics?.bookingsDaily?.length ?? 0;
  const avgBookingValueCents = totalBookings ? Math.round(totalGmvCents / totalBookings) : 0;
  const avgDailyBookings = dayCount ? Math.round(totalBookings / dayCount) : 0;
  const avgDailyGmvCents = dayCount ? Math.round(totalGmvCents / dayCount) : 0;

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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bookings (30d)</p>
              <p className="text-sm text-slate-600">Daily booking volume</p>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics?.bookingsDaily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: any) => [`${value}`, "Bookings"]}
                  labelFormatter={(label) => formatShortDate(label)}
                />
                <Line type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GMV (30d)</p>
          <p className="text-sm text-slate-600">Daily gross booking value</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.bookingsDaily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v / 100}`} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), "GMV"]}
                  labelFormatter={(label) => formatShortDate(label)}
                />
                <Bar dataKey="gmvCents" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listings by status</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.listingStatus ?? []} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f172a" radius={[6, 6, 6, 6]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fraud + risk events (30d)</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.fraudByType ?? []} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="eventType"
                  tick={{ fontSize: 11 }}
                  width={140}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" radius={[6, 6, 6, 6]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average booking value</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(avgBookingValueCents)}</p>
          <p className="text-xs text-slate-500">30-day average</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg daily bookings</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{avgDailyBookings || "—"}</p>
          <p className="text-xs text-slate-500">Last 30 days</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg daily GMV</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(avgDailyGmvCents)}</p>
          <p className="text-xs text-slate-500">Last 30 days</p>
        </div>
      </div>
    </div>
  );
}
