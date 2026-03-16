"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../components/AuthProvider";
import { listAdminBookings } from "../../../lib/api";

type BookingRow = {
  id: string;
  listing_title: string;
  listing_address: string;
  driver_email?: string | null;
  host_email?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  amount_cents?: number | null;
  currency?: string | null;
  created_at: string;
};

const statusOptions = ["pending", "confirmed", "canceled"];

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
};

const formatMoney = (cents?: number | null, currency?: string | null) => {
  if (!cents) return "—";
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: (currency ?? "eur").toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ""}`;
  }
};

export default function AdminBookingsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [listingId, setListingId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const bookings = await listAdminBookings(
        {
          status: status || undefined,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
          listingId: listingId || undefined,
          userId: userId || undefined,
        },
        token
      );
      setRows(bookings as BookingRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const haystack = [
      row.id,
      row.listing_title,
      row.listing_address,
      row.driver_email,
      row.host_email,
      row.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl tracking-tight font-semibold text-slate-900">Bookings</h1>
          <p className="text-sm text-slate-600">Search and review bookings.</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <label className="text-xs font-semibold text-slate-600">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          >
            <option value="">All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Listing ID
          <input
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            placeholder="UUID"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          User ID
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            placeholder="UUID"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600 md:col-span-2">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            placeholder="Listing, address, email, status"
          />
        </label>
        <button
          onClick={load}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 md:col-span-6 lg:col-span-1"
        >
          Apply filters
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Listing</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Driver</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Host</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Window</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Amount</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{row.listing_title}</div>
                  <div className="text-xs text-slate-500">{row.listing_address}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.driver_email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.host_email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div>{formatDateTime(row.start_time)}</div>
                  <div className="text-xs text-slate-400">→ {formatDateTime(row.end_time)}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatMoney(row.amount_cents, row.currency)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/bookings/${row.id}`}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-3 text-sm text-slate-600">Loading…</div>}
      </div>
    </div>
  );
}
