"use client";

import { useState } from "react";
import { CheckCircle, ChevronRight } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import { requestEmailVerification } from "../../../lib/api";

const MANAGE_LINKS = [
  { href: "/dashboard/personal-info", label: "Personal info",    desc: "Your name and phone number" },
  { href: "/dashboard/security",       label: "Login & security", desc: "Password and active sessions" },
  { href: "/dashboard/vehicle",        label: "Vehicle",          desc: "Registration plate, make and colour" },
  { href: "/dashboard/support",        label: "Support",          desc: "Get help with a booking or your account" },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resendVerification = async () => {
    if (!user?.email) return;
    setSending(true); setMessage(null); setError(null);
    try {
      await requestEmailVerification(user.email);
      setMessage("Verification email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email");
    } finally { setSending(false); }
  };

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase()
    || user?.email?.charAt(0)?.toUpperCase()
    || "?";

  return (
    <div className="space-y-9">
      {/* Identity moment — no box, sits on the canvas */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500">Account</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[26px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(10,128,80,0.5)]">
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[26px] font-bold tracking-[-0.02em] text-slate-900">
              {user?.name?.trim() || "Your account"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] text-slate-500">{user?.email}</span>
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                  <CheckCircle className="h-3 w-3" strokeWidth={2.5} /> Verified
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Unverified</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          <CheckCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>
      )}

      {/* Verify prompt — only if needed, inline and quiet */}
      {!user?.emailVerified && (
        <div className="flex flex-col gap-3 rounded-2xl bg-amber-50/60 px-5 py-4 ring-1 ring-amber-200/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13.5px] font-semibold text-amber-900">Confirm your email</p>
            <p className="mt-0.5 text-[12.5px] text-amber-700">Verify your address to secure your account and bookings.</p>
          </div>
          <button
            onClick={resendVerification}
            disabled={sending}
            className="shrink-0 rounded-xl bg-amber-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-amber-950 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Resend email"}
          </button>
        </div>
      )}

      {/* Manage — borderless divided list, no card */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500">Manage</p>
        <div className="mt-3 divide-y divide-slate-200/70 border-y border-slate-200/70">
          {MANAGE_LINKS.map(({ href, label, desc }) => (
            <a key={href} href={href} className="group flex items-center justify-between gap-4 py-4 transition">
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold text-slate-900 transition group-hover:text-brand-600">{label}</p>
                <p className="mt-0.5 text-[12.5px] text-slate-500">{desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" strokeWidth={2.5} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
