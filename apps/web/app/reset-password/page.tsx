"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { requestPasswordReset, resetPassword } from "../../lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-10 text-sm text-slate-600">Loading…</div>}>
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestPasswordReset(email.trim());
      setPreviewUrl(result.previewUrl ?? null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
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
    <div className="min-h-[100dvh] bg-slate-50 px-4 pb-12 pt-8">
      <div className="mx-auto max-w-md">
        <div className="space-y-3 text-center">
          <img src="/freespace-logo.png" alt="FreeSpace" className="mx-auto h-16 w-auto mix-blend-multiply sm:h-20" />
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-700">ACCOUNT RECOVERY</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Reset password</h1>
          <p className="text-sm text-slate-600">
            {step === "request" ? "Enter your email and we'll send you a reset link." : "Choose a new password for your account."}
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          {step === "request" ? (
            done ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                  <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-900">Check your inbox</p>
                <p className="text-sm text-slate-600">If an account exists for <strong>{email}</strong>, we sent a reset link. Click it to set a new password.</p>
                {previewUrl && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
                    <p className="font-semibold">Dev mode — mailer not configured</p>
                    <a href={previewUrl} className="mt-2 inline-block rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white">
                      Open reset link
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleRequest} className="space-y-4">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Email
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-lg border border-slate-200 px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                    placeholder="you@example.com"
                  />
                </label>
                <button type="submit" className="btn-primary w-full" disabled={submitting}>
                  {submitting ? "Sending..." : "Send reset link"}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                New password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                  placeholder="••••••••"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Confirm password
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </label>
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? "Updating..." : "Set new password"}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-5 text-center text-sm text-slate-600">
            <Link href="/login" className="font-semibold text-brand-700">Back to login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
