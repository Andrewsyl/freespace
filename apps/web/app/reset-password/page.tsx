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

  const eyebrow = step === "reset" ? "Account security" : "Account recovery";
  const heading = step === "reset" ? "Set new password" : "Reset password";
  const subtitle = step === "reset"
    ? "Choose a new password for your account."
    : "Enter your email and we'll send you a reset link.";

  return (
    <div className="min-h-[100dvh] bg-[#eef0f4] px-4 pb-12 pt-10">
      <div className="mx-auto max-w-sm">

        {/* Header */}
        <div className="mb-8 text-center">
          <img
            src="/freespace-logo.png"
            alt="FreeSpace"
            className="mx-auto mb-5 h-14 w-auto mix-blend-multiply"
          />
          <p className="mb-3 text-[11px] font-bold tracking-[0.18em] text-brand-600 uppercase">
            {eyebrow}
          </p>
          <h1 className="text-[32px] font-bold tracking-tight text-slate-900">{heading}</h1>
          <p className="mt-2 text-[15px] text-slate-500">{subtitle}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white px-6 py-7 shadow-sm">
          {step === "request" ? (
            done ? (
              /* ── Sent confirmation ── */
              <div className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                  <svg className="h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-[18px] font-bold text-slate-900">Check your inbox</p>
                <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
                  If an account exists for{" "}
                  <strong className="font-semibold text-slate-800">{email}</strong>
                  {", "}we sent a reset link. Click it to set a new password.
                </p>
                {previewUrl && (
                  <div className="mt-4 w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
                    <p className="font-semibold">Dev — mailer not configured</p>
                    <a href={previewUrl} className="mt-2 inline-block rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white">
                      Open reset link
                    </a>
                  </div>
                )}
                <Link href="/login" className="mt-6 text-[15px] font-semibold text-brand-600 hover:text-brand-700">
                  Back to login
                </Link>
              </div>
            ) : (
              /* ── Request form ── */
              <form onSubmit={handleRequest} className="space-y-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  Email address
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                    placeholder="you@example.com"
                    autoFocus
                  />
                </label>
                <button
                  type="submit"
                  className="flex h-12 w-full items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Send reset link"}
                </button>
              </form>
            )
          ) : (
            /* ── New password form ── */
            <form onSubmit={handleReset} className="space-y-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                New password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border border-slate-200 px-3.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                  placeholder="••••••••"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                Confirm password
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 rounded-xl border border-slate-200 px-3.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </label>
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? "Updating…" : "Set new password"}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!(step === "request" && done) && (
            <p className="mt-5 text-center text-sm text-slate-500">
              <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                Back to login
              </Link>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
