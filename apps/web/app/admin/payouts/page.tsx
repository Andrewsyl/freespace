"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { listAdminPayouts } from "../../../lib/api";

type PayoutRow = {
  id: string;
  amount_cents?: number | null;
  platform_fee_cents?: number | null;
  currency?: string | null;
  payout_status?: string | null;
  payout_available_at?: string | null;
  stripe_transfer_id?: string | null;
  listing_title?: string | null;
  host_email?: string | null;
};

const formatMoney = (cents?: number | null, currency?: string | null) => {
  if (!cents) return "—";
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: (currency ?? "eur").toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ""}`;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
};

export default function AdminPayoutsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payoutRun, setPayoutRun] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const payouts = await listAdminPayouts({ status: status || undefined }, token);
      setRows(payouts as PayoutRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payouts");
    } finally {
      setLoading(false);
    }
  };

  const runPayouts = async () => {
    if (!token) return;
    setPayoutRun(null);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000"}/api/admin/payouts/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).message ?? "Failed to run payouts");
      setPayoutRun(`Processed ${data.processed ?? 0} payout(s).`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run payouts");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const haystack = [row.listing_title, row.host_email, row.payout_status, row.stripe_transfer_id, row.id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl tracking-tight font-semibold text-slate-900">Payouts</h1>
          <p className="text-sm text-slate-600">Queue and payout status.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runPayouts}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Run payouts
          </button>
          <button
            onClick={load}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Search listing, host, transfer"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="paid">Paid</option>
          <option value="canceled">Canceled</option>
        </select>
        <button
          onClick={load}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Apply filter
        </button>
      </div>

      {payoutRun && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{payoutRun}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Listing</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Host</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Net amount</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Available</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Transfer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row) => {
              const net = (row.amount_cents ?? 0) - (row.platform_fee_cents ?? 0);
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.listing_title ?? "—"}</div>
                    <div className="text-xs text-slate-600">Booking: {row.id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.host_email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{formatMoney(net, row.currency)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {row.payout_status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.payout_available_at)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{row.stripe_transfer_id ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && <div className="p-3 text-sm text-slate-600">Loading…</div>}
      </div>
    </div>
  );
}
