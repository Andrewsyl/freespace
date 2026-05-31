"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyEmail } from "../../lib/api";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#eef0f4]" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!token) { setError("Missing verification token."); setStatus("error"); return; }
    setStatus("loading");
    try {
      await verifyEmail(token);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. The link may have expired.");
      setStatus("error");
    }
  };

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
            Account setup
          </p>
          <h1 className="text-[32px] font-bold tracking-tight text-slate-900">
            {status === "success" ? "You're verified" : "Verify your email"}
          </h1>
          <p className="mt-2 text-[15px] text-slate-500">
            {status === "success"
              ? "Your email address has been confirmed."
              : "Confirm your email address to activate your account."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white px-6 py-7 shadow-sm">

          {status === "success" ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                <svg className="h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[17px] font-bold text-slate-900">Email confirmed</p>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
                Your FreeSpace account is now active. You can open the app or continue on the web.
              </p>

              <div className="mt-6 flex w-full flex-col gap-3">
                {/* Deep link — opens app if installed */}
                <a
                  href="carparking://verified"
                  className="flex h-12 items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white transition hover:bg-brand-600"
                >
                  Open FreeSpace app
                </a>
                <Link
                  href="/"
                  className="flex h-12 items-center justify-center rounded-full border border-slate-200 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Continue on web
                </Link>
              </div>
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
                <svg className="h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p className="text-[17px] font-bold text-slate-900">Link expired</p>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-500">{error}</p>
              <Link href="/login" className="mt-6 text-[15px] font-semibold text-brand-600 hover:text-brand-700">
                Back to login
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                <svg className="h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[17px] font-bold text-slate-900">Confirm your email</p>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
                Tap below to verify your email address and unlock all FreeSpace features.
              </p>
              <button
                type="button"
                onClick={handleVerify}
                disabled={status === "loading"}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
              >
                {status === "loading" ? "Verifying…" : "Verify my email"}
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
