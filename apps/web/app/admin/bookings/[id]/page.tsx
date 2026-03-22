"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../../../components/AuthProvider";
import { getAdminBooking, updateAdminBooking } from "../../../../lib/api";

const statusOptions = ["pending", "confirmed", "canceled"];

const formatDateTime = (value: string) => {
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

export default function AdminBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const [booking, setBooking] = useState<any | null>(null);
  const [status, setStatus] = useState<string>("");
  const [refundId, setRefundId] = useState<string>("");
  const [issueRefund, setIssueRefund] = useState(false);
  const [markNoShow, setMarkNoShow] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!token || !params?.id) return;
    setError(null);
    try {
      const data = await getAdminBooking(params.id, token);
      setBooking(data);
      setStatus(data?.status ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load booking");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, params?.id]);

  const applyUpdate = async () => {
    if (!token || !params?.id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminBooking(
        params.id,
        {
          status: status || undefined,
          refundId: refundId || undefined,
          issueRefund: issueRefund || undefined,
          markNoShow: markNoShow || undefined,
          reason: reason || undefined,
        },
        token
      );
      setBooking((prev: any) => ({ ...prev, ...updated }));
      setReason("");
      setIssueRefund(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (!booking) {
    return <div className="p-4 text-sm text-slate-600">{error ?? "Loading booking…"}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl tracking-tight font-semibold text-slate-900">Booking detail</h1>
        <p className="text-sm text-slate-600">{booking.id}</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Details</h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex justify-between">
              <dt className="text-slate-500">Listing</dt>
              <dd className="font-semibold">{booking.listing_title}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Driver</dt>
              <dd>{booking.driver_email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Host</dt>
              <dd>{booking.host_email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Start</dt>
              <dd>{formatDateTime(booking.start_time)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">End</dt>
              <dd>{formatDateTime(booking.end_time)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Refund status</dt>
              <dd>{booking.refund_status ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Refund ID</dt>
              <dd className="max-w-[14rem] truncate">{booking.refund_id ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Refunded at</dt>
              <dd>{booking.refunded_at ? formatDateTime(booking.refunded_at) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">No-show marked</dt>
              <dd>{booking.no_show_at ? formatDateTime(booking.no_show_at) : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Admin actions</h2>
          <div className="mt-3 space-y-3 text-sm">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Refund ID (optional)
              <input
                value={refundId}
                onChange={(e) => setRefundId(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                placeholder="re_123"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={issueRefund} onChange={(e) => setIssueRefund(e.target.checked)} />
              Create Stripe refund now
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={markNoShow} onChange={(e) => setMarkNoShow(e.target.checked)} />
              Mark no-show
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Reason (audit log)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                rows={3}
              />
            </label>
            <button
              onClick={applyUpdate}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Apply update"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm">
        <p className="font-semibold text-slate-900">Operational handling</p>
        <ul className="mt-2 space-y-1">
          <li>Use host cancellation when the space cannot be honored. Refunds should be created or confirmed in the same action.</li>
          <li>Use no-show only when the booked window started and the driver never arrived.</li>
          <li>Overstay issues should keep the booking record intact and be documented through support or admin notes with timestamps.</li>
        </ul>
      </div>
    </div>
  );
}
