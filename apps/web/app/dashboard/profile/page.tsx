"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import { requestEmailVerification } from "../../../lib/api";

export default function ProfilePage() {
  const { user, token } = useAuth();
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

  const handleDelete = async () => {
    if (!confirm("Delete your account permanently? This cannot be undone.")) return;
    setDeleting(true); setError(null);
    try {
      await deleteAccount(token ?? undefined);
      signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account");
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4 px-8">
      {/* Page header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Account</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Profile</h1>
      </div>

      {message && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          <CheckCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>
      )}

      {/* Details card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-[15px] font-bold text-slate-900">Details</h2>
          {user?.emailVerified ? (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200">Verified</span>
          ) : (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">Unverified</span>
          )}
        </div>
        <div className="divide-y divide-slate-100 px-6">
          <div className="flex items-center justify-between py-3.5">
            <span className="text-[13px] text-slate-500">Email</span>
            <span className="text-[13px] font-semibold text-slate-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-3.5">
            <span className="text-[13px] text-slate-500">Role</span>
            <span className="text-[13px] font-semibold text-slate-900">{user?.role ?? "driver"}</span>
          </div>
        </div>
        {!user?.emailVerified && (
          <div className="px-6 pb-5 pt-3">
            <button onClick={resendVerification} disabled={sending}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-brand-500 text-[13.5px] font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {sending ? "Sending…" : "Resend verification email"}
            </button>
          </div>
        )}
      </div>

      {/* More settings */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="mb-3 text-[15px] font-bold text-slate-900">More settings</h2>
        <div className="divide-y divide-slate-100">
          {[
            { href: "/dashboard/personal-info", label: "Personal Info",    desc: "Edit your name and phone number" },
            { href: "/dashboard/security",       label: "Login & Security", desc: "Change password, manage sessions" },
            { href: "/dashboard/vehicle",        label: "My Vehicle",       desc: "Registration plate, make and colour" },
            { href: "/dashboard/support",        label: "Support",          desc: "Get help with a booking or account" },
          ].map(({ href, label, desc }) => (
            <a key={href} href={href} className="flex items-center justify-between py-3 transition hover:text-brand-600">
              <div>
                <p className="text-[13.5px] font-semibold text-slate-800">{label}</p>
                <p className="text-[12px] text-slate-400">{desc}</p>
              </div>
              <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
