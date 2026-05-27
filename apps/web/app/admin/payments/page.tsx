"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { listAdminPayments } from "../../../lib/api";

type PaymentRow = {
  id: string;
  payment_intent_id: string;
  checkout_session_id?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  status?: string | null;
  receipt_url?: string | null;
  created_at: string;
  driver_email?: string | null;
  listing_title?: string | null;
};

const formatMoney = (cents?: number | null, currency?: string | null) => {
  if (!cents) return "—";
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: (currency ?? "eur").toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ""}`;
  }
};

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
};

export default function AdminPaymentsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const payments = await listAdminPayments({ status: status || undefined }, token);
      setRows(payments as PaymentRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
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
      row.payment_intent_id,
      row.checkout_session_id,
      row.listing_title,
      row.driver_email,
      row.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl tracking-tight font-semibold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-600">Recent payment intents.</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Search intent, listing, email"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="canceled">Canceled</option>
        </select>
        <button
          onClick={load}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Apply filter
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment intent</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Listing</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Driver</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Amount</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-xs text-slate-700">{row.payment_intent_id}</td>
                <td className="px-4 py-3 text-slate-700">{row.listing_title ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.driver_email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{formatMoney(row.amount_cents, row.currency)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {row.status ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-3 text-sm text-slate-600">Loading…</div>}
      </div>
    </div>
  );
}
