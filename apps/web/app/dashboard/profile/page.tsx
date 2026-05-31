"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import { deleteAccount, requestEmailVerification } from "../../../lib/api";

export default function ProfilePage() {
  const { user, token, signOut } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    <>
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Account</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Profile</h1>
      </div>

      {message && (
        <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          <CheckCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
          {message}
        </div>
      )}
      {error && (
        <div className="mx-5 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>
      )}

      <section className="border-b border-slate-200 px-5 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Details</h2>
          {user?.emailVerified ? (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200">Verified</span>
          ) : (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">Unverified</span>
          )}
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          <div className="flex items-center justify-between py-3">
            <span className="text-[13px] text-slate-500">Email</span>
            <span className="text-[13px] font-semibold text-slate-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-[13px] text-slate-500">Role</span>
            <span className="text-[13px] font-semibold text-slate-900">{user?.role ?? "driver"}</span>
          </div>
        </div>
        {!user?.emailVerified && (
          <button onClick={resendVerification} disabled={sending}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-brand-500 text-[14px] font-semibold text-white active:bg-brand-600 disabled:opacity-60">
            {sending ? "Sending…" : "Resend verification email"}
          </button>
        )}
      </section>

      <section className="border-b border-slate-200 px-5 py-6">
        <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Quick links</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { href: "/dashboard", label: "Your trips" },
            { href: "/host/dashboard", label: "Host dashboard" },
            { href: "/dashboard/payments", label: "Payments" },
            { href: "/dashboard/earnings", label: "Earnings" },
          ].map(({ href, label }) => (
            <Link key={href} href={href as any}
              className="rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 active:bg-slate-50">
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="px-5 py-6">
        <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Danger zone</h2>
        <p className="mt-2 text-[14px] leading-6 text-slate-600">
          Permanently removes your account, listings, and bookings. This cannot be undone.
        </p>
        <button onClick={handleDelete} disabled={deleting}
          className="mt-4 flex h-11 items-center justify-center rounded-2xl border border-rose-200 px-5 text-[14px] font-semibold text-rose-600 active:bg-rose-50 disabled:opacity-60">
          {deleting ? "Deleting…" : "Delete account"}
        </button>
      </section>
    </>
  );
}
