"use client";

import { useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { sendSupportMessage } from "../../../lib/api";

const SUBJECTS = [
  "Booking issue",
  "Refund request",
  "Could not access the space",
  "Booking charged but not confirmed",
  "Host cancellation or arrival issue",
  "Account access or verification problem",
  "Payment or billing question",
  "Listing or hosting issue",
  "Report a safety concern",
  "Other",
];

export default function SupportPage() {
  const { token } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError("Sign in to contact support."); return; }
    if (message.trim().length < 10) { setError("Please provide more detail (at least 10 characters)."); return; }
    setStatus("loading"); setError(null);
    try {
      await sendSupportMessage(token, { subject: subject || "Other", message: message.trim() });
      setStatus("success");
      setSubject(""); setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-4 px-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Help</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Support</h1>
        <p className="mt-1 text-[13.5px] text-slate-600">For booking issues, refunds, and account questions.</p>
      </div>

      {status === "success" ? (
        <div className="rounded-xl border border-brand-100 bg-brand-50 px-6 py-8 text-center shadow-sm">
          <p className="text-[16px] font-bold text-brand-700">Message sent</p>
          <p className="mt-1 text-[13px] text-brand-600">We&apos;ll get back to you as soon as possible.</p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-4 rounded-lg border border-brand-200 px-5 py-2 text-[13px] font-semibold text-brand-700 hover:bg-brand-100"
          >
            Send another
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-slate-600">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Select a topic…</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-slate-600">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Describe your issue in detail…"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
              />
              <p className="mt-1 text-right text-[11px] text-slate-600">{message.length} characters (10 minimum)</p>
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-brand-500 py-3 text-[14px] font-bold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {status === "loading" ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
