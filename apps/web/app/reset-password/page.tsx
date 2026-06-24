"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, AlertTriangle, ArrowLeft } from "lucide-react";
import { requestPasswordReset, resetPassword } from "../../lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const step = token ? "reset" : "request";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setTimeout(() => router.push("/login"), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      {/* Minimal header */}
      <header className="flex h-14 items-center border-b border-slate-200 bg-white px-5">
        <Link href="/login" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 transition hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to login
        </Link>
        <Link href="/" className="ml-auto">
          <img src="/freespace-logo-grid-black.png" alt="FreeSpace" className="h-8 w-auto" />
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-[380px] rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">

          {step === "request" && done ? (
            /* ── Email sent confirmation ── */
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
                <Mail className="h-7 w-7 text-brand-500" strokeWidth={1.75} />
              </div>
              <h1 className="text-[20px] font-bold text-slate-900">Check your inbox</h1>
              <p className="mt-2 text-[14px] leading-6 text-slate-500">
                If an account exists for <strong className="font-medium text-slate-700">{email}</strong>, we sent a reset link.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-[14px] font-bold text-white transition hover:bg-brand-600"
              >
                Back to login
              </Link>
            </div>

          ) : step === "request" ? (
            /* ── Request reset ── */
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Reset password</h1>
              <p className="mt-1.5 text-[14px] text-slate-500">
                Enter your email and we&apos;ll send a reset link.
              </p>
              <form onSubmit={handleRequest} className="mt-6 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Email address</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-[14px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </div>

          ) : (
            /* ── Set new password ── */
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Set new password</h1>
              <p className="mt-1.5 text-[14px] text-slate-500">Choose a new password for your account.</p>
              <form onSubmit={handleReset} className="mt-6 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">New password</label>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Confirm password</label>
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-[14px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {submitting ? "Updating…" : "Set new password"}
                </button>
              </form>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" strokeWidth={2} />
              <p className="text-[13px] text-rose-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
