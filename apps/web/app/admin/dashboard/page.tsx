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
    return new Date(value).toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "short",
      timeZone: "Europe/Dublin",
    });
  } catch {
    return value;
  }
};

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString("en-IE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Dublin",
    });
  } catch {
    return value;
  }
};

const formatPercent = (value: number) => `${Math.round((value ?? 0) * 100)}%`;

const eventLabel: Record<string, string> = {
  booking_conflict: "Booking conflict",
  booking_email_failed: "Booking email failed",
  orphan_payment_refunded: "Orphan payment refunded",
  orphan_payment_already_refunded: "Orphan payment already refunded",
  stripe_webhook_failed: "Stripe webhook failed",
  operational_alert: "Operational alert",
  host_booking_canceled: "Host canceled booking",
  booking_status_transition_skipped: "Booking state transition skipped",
  web_search_failed: "Web search failed",
  mobile_search_failed: "Mobile search failed",
  web_host_publish_failed: "Web host publish failed",
  mobile_host_publish_failed: "Mobile host publish failed",
  mobile_booking_failed: "Mobile booking failed",
  "client.error_reported": "Client error reported",
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
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics?.userCount ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listings</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics?.listingCount ?? "—"}</p>
          <p className="text-xs text-slate-500">Active: {metrics?.activeListingCount ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bookings (30d)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics?.bookings30d ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GMV (30d)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {metrics ? formatCurrency(metrics.gmv30dCents) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payout backlog</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics?.payoutBacklog ?? "—"}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Discovery funnel (30d)</p>
              <p className="text-sm text-slate-600">Search demand and listing engagement across web and mobile</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Searches completed</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{metrics?.discoveryFunnel.searchCompleted ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listing views</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{metrics?.discoveryFunnel.listingViewed ?? "—"}</p>
              <p className="mt-1 text-xs text-slate-500">
                View rate: {metrics ? formatPercent(metrics.discoveryFunnel.listingViewRate) : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average booking value</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(avgBookingValueCents)}</p>
          <p className="text-xs text-slate-500">30-day average</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg daily bookings</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{avgDailyBookings || "—"}</p>
          <p className="text-xs text-slate-500">Last 30 days</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg daily GMV</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(avgDailyGmvCents)}</p>
          <p className="text-xs text-slate-500">Last 30 days</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signup funnel (30d)</p>
              <p className="text-sm text-slate-600">Registration to verified account activity</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed up</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{metrics?.signupFunnel.signedUp ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verified email</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{metrics?.signupFunnel.verifiedEmail ?? "—"}</p>
              <p className="mt-1 text-xs text-slate-500">
                Verify rate: {metrics ? formatPercent(metrics.signupFunnel.verifyRate) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logged in</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{metrics?.signupFunnel.loggedIn ?? "—"}</p>
              <p className="mt-1 text-xs text-slate-500">
                Login rate: {metrics ? formatPercent(metrics.signupFunnel.loginRate) : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booking funnel (30d)</p>
              <p className="text-sm text-slate-600">Client intent plus backend payment completion</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listings published</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{metrics?.bookingFunnel.listingPublished ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checkout started</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{metrics?.bookingFunnel.checkoutStarted ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment intent created</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{metrics?.bookingFunnel.paymentIntentCreated ?? "—"}</p>
              <p className="mt-1 text-xs text-slate-500">
                Checkout to intent: {metrics ? formatPercent(metrics.bookingFunnel.checkoutToIntentRate) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Confirmed</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">{metrics?.bookingFunnel.confirmed ?? "—"}</p>
              <p className="mt-1 text-xs text-emerald-700">
                Checkout to confirmed: {metrics ? formatPercent(metrics.bookingFunnel.checkoutToConfirmedRate) : "—"}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publish to checkout</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {metrics ? formatPercent(metrics.bookingFunnel.publishToCheckoutRate) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operational alerts</p>
              <p className="text-sm text-slate-600">Recent booking, payment, webhook, and delivery failures.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {(metrics?.recentOperationalEvents ?? []).map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {eventLabel[event.eventType] ?? event.eventType}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
                </div>
                {event.payload?.bookingId || event.payload?.listingId || event.payload?.paymentIntentId ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {[event.payload?.bookingId ? `Booking ${String(event.payload.bookingId).slice(0, 8)}` : null,
                      event.payload?.listingId ? `Listing ${String(event.payload.listingId).slice(0, 8)}` : null,
                      event.payload?.paymentIntentId ? `Payment ${String(event.payload.paymentIntentId).slice(0, 12)}` : null]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                ) : null}
              </div>
            ))}
            {!metrics?.recentOperationalEvents?.length ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                No recent operational alerts.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product failures</p>
              <p className="text-sm text-slate-600">Recent search, booking, publish, and client-side failures.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {(metrics?.recentProductFailures ?? []).map((event) => (
              <div key={event.id} className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {eventLabel[event.eventType] ?? event.eventType}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
                </div>
                {event.payload?.message ? (
                  <p className="mt-1 text-xs text-slate-600">{String(event.payload.message)}</p>
                ) : null}
              </div>
            ))}
            {!metrics?.recentProductFailures?.length ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                No recent product failures.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
