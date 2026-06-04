"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, CheckCircle, AlertTriangle } from "lucide-react";
import { requestPasswordReset, resetPassword } from "../../lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-white"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
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
      const result = await requestPasswordReset(email.trim());
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
    <div className="flex min-h-[100dvh] flex-col bg-white px-5 pb-10 pt-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/freespace-logo-grid-black.png" alt="FreeSpace" className="mx-auto mb-6 h-10 w-auto" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
            {step === "reset" ? "Account security" : "Account recovery"}
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-slate-900">
            {step === "reset" ? "Set new password" : "Reset password"}
          </h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            {step === "reset" ? "Choose a new password for your account." : "Enter your email and we'll send a reset link."}
          </p>
        </div>

        {step === "request" && done ? (
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <Mail className="h-8 w-8 text-brand-500" strokeWidth={1.75} />
            </div>
            <p className="text-[17px] font-bold text-slate-900">Check your inbox</p>
            <p className="mt-2 text-[14px] leading-6 text-slate-500">
              If an account exists for <strong className="font-semibold text-slate-800">{email}</strong>, we sent a reset link.
            </p>
            <Link href="/login" className="mt-6 text-[15px] font-semibold text-brand-600">Back to login</Link>
          </div>
        ) : step === "request" ? (
          <form onSubmit={handleRequest} className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Email address</label>
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-[14px] shadow-sm focus:border-brand-500 focus:outline-none"
                placeholder="you@example.com" autoFocus
              />
            </div>
            <button type="submit" disabled={submitting}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white transition active:bg-brand-600 disabled:opacity-50">
              {submitting ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center text-[14px] text-slate-500">
              <Link href="/login" className="font-semibold text-brand-600">Back to login</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-slate-700">New password</label>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-[14px] shadow-sm focus:border-brand-500 focus:outline-none"
                placeholder="••••••••" autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Confirm password</label>
              <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-[14px] shadow-sm focus:border-brand-500 focus:outline-none"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={submitting}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white transition active:bg-brand-600 disabled:opacity-50">
              {submitting ? "Updating…" : "Set new password"}
            </button>
            <p className="text-center text-[14px] text-slate-500">
              <Link href="/login" className="font-semibold text-brand-600">Back to login</Link>
            </p>
          </form>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" strokeWidth={2} />
            <p className="text-[13px] text-rose-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
