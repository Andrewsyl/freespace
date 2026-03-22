"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { listAdminSupportTickets, updateAdminSupportTicket } from "../../../lib/api";

type TicketRow = {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_note?: string | null;
  assigned_admin_id?: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string | null;
};

const statusOptions = ["open", "in_progress", "resolved", "closed"];
const priorityOptions = ["low", "normal", "high", "urgent"];

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString("en-IE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Dublin",
    });
  } catch {
    return value;
  }
};

export default function AdminSupportPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const tickets = await listAdminSupportTickets(
        {
          status: status || undefined,
          priority: priority || undefined,
          search: search || undefined,
        },
        token
      );
      setRows(tickets as TicketRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updateTicket = async (id: string, payload: Record<string, any>) => {
    if (!token) return;
    setError(null);
    try {
      const updated = await updateAdminSupportTicket(id, payload, token);
      setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ticket");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl tracking-tight font-semibold text-slate-900">Support tickets</h1>
          <p className="text-sm text-slate-600">Review and triage inbound support.</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
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
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          >
            <option value="">All</option>
            {priorityOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 md:col-span-2">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            placeholder="Subject or user email"
          />
        </label>
        <button
          onClick={load}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 md:col-span-4 lg:col-span-1"
        >
          Apply filters
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="space-y-3">
        {rows.map((ticket) => (
          <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                <p className="text-xs text-slate-500">
                  {ticket.user_email ?? "Unknown user"} • {formatDate(ticket.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={ticket.status}
                  onChange={(e) => updateTicket(ticket.id, { status: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={ticket.priority}
                  onChange={(e) => updateTicket(ticket.id, { priority: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  {priorityOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{ticket.message}</p>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              defaultValue={ticket.admin_note ?? ""}
              placeholder="Internal note"
              onBlur={(e) => updateTicket(ticket.id, { adminNote: e.target.value })}
            />
            <p className="mt-2 text-xs text-slate-500">Updated {formatDate(ticket.updated_at)}</p>
          </div>
        ))}
        {loading && <div className="text-sm text-slate-600">Loading…</div>}
      </div>
    </div>
  );
}
