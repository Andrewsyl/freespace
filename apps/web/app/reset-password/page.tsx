"use client";

import { Suspense, useMemo, useState } from "react";
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
  const initialToken = searchParams.get("token") ?? "";
  const [step, setStep] = useState<"request" | "reset">(initialToken ? "reset" : "request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const extractedPreviewToken = useMemo(() => {
    if (!previewUrl) return "";
    try {
      const url = new URL(previewUrl);
      return url.searchParams.get("token") ?? "";
    } catch {
      return "";
    }
  }, [previewUrl]);

  const extractToken = (value: string) => {
    try {
      const url = new URL(value);
      return url.searchParams.get("token") ?? "";
    } catch {
      return "";
    }
  };

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestPasswordReset(email.trim());
      setPreviewUrl(result.previewUrl ?? null);
      setNotice(
        result.previewUrl
          ? "Reset link generated. Open it or use the token below."
          : "If an account exists, we sent a reset link."
      );
      if (result.previewUrl) {
        setToken(extractToken(result.previewUrl));
      }
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (token.trim().length < 10) {
      setError("Enter the reset token from your email.");
      return;
    }
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
    setNotice(null);
    try {
      await resetPassword(token.trim(), password);
      setNotice("Password updated. You can sign in now.");
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
            Request a reset link, then set a new password.
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          {step === "request" ? (
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
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {previewUrl ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p>Mailer is not configured yet. Use the preview link for now.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={previewUrl}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Open preview link
                    </a>
                    {extractedPreviewToken ? (
                      <button
                        type="button"
                        className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900"
                        onClick={() => setToken(extractedPreviewToken)}
                      >
                        Use preview token
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Reset token
                <input
                  required
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                  placeholder="Paste token from email"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                New password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                  placeholder="••••••••"
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
                {submitting ? "Updating..." : "Update password"}
              </button>
            </form>
          )}

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {notice}
            </div>
          ) : null}

          <div className="mt-5 text-center text-sm text-slate-600">
            <Link href="/login" className="font-semibold text-brand-700">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
