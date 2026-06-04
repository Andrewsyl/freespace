"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { listAdminEvents } from "../../../lib/api";

type FraudEvent = {
  id: string;
  event_type: string;
  payload: {
    reason?: string;
    ip?: string;
    path?: string;
    userId?: string | null;
    email?: string | null;
  };
  created_at: string;
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
};

export default function FraudEventsPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<FraudEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [eventType, setEventType] = useState("fraud_blocked");
  const limit = 50;

  const load = async (nextOffset = 0, nextEventType = eventType) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminEvents({ eventType: nextEventType, limit, offset: nextOffset }, token);
      setEvents(data as FraudEvent[]);
      setOffset(nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fraud events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0, eventType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventType]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Fraud events</h1>
          <p className="text-sm text-slate-600">Blocked or flagged activity from fraud controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="fraud_blocked">Fraud blocked</option>
            <option value="payment_mismatch">Payment mismatch</option>
            <option value="payment_retry_limit">Payment retry limit</option>
            <option value="support_duplicate">Support duplicates</option>
            <option value="review_suspicious">Suspicious reviews</option>
            <option value="geo_mismatch">Geo mismatch</option>
            <option value="push_token_abuse">Push token abuse</option>
          </select>
          <button
            onClick={() => load(offset)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.1fr_1fr_1.3fr_1.2fr_1.4fr] gap-2 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <span>Time</span>
          <span>Reason</span>
          <span>User / Email</span>
          <span>IP</span>
          <span>Path</span>
        </div>
        <div className="divide-y divide-slate-100">
          {loading && (
            <div className="px-4 py-4 text-sm text-slate-600">Loading…</div>
          )}
          {!loading && events.length === 0 && (
            <div className="px-4 py-4 text-sm text-slate-600">No events yet.</div>
          )}
          {events.map((event) => (
            <div key={event.id} className="grid grid-cols-[1.1fr_1fr_1.3fr_1.2fr_1.4fr] gap-2 px-4 py-3 text-sm text-slate-700">
              <span>{formatDate(event.created_at)}</span>
              <span className="text-slate-900">{event.payload?.reason ?? event.event_type}</span>
              <span className="truncate">
                {event.payload?.userId ?? "—"}
                {event.payload?.email ? ` • ${event.payload.email}` : ""}
              </span>
              <span>{event.payload?.ip ?? "—"}</span>
              <span className="truncate">{event.payload?.path ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <button
          onClick={() => load(Math.max(0, offset - limit))}
          disabled={offset === 0 || loading}
          className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
        >
          Newer
        </button>
        <span>Showing {events.length === 0 ? 0 : offset + 1}–{offset + events.length}</span>
        <button
          onClick={() => load(offset + limit)}
          disabled={loading || events.length < limit}
          className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
        >
          Older
        </button>
      </div>
    </div>
  );
}
