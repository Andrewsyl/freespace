"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle, AlertTriangle } from "lucide-react";
import { verifyEmail } from "../../lib/api";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-white"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-5 pb-10">
      <div className="w-full max-w-sm text-center">
        <img src="/freespace-logo.png" alt="FreeSpace" className="mx-auto mb-8 h-10 w-auto mix-blend-multiply" />

        {status === "success" ? (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <CheckCircle className="h-8 w-8 text-brand-500" strokeWidth={1.75} />
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.03em] text-slate-900">Email confirmed</h1>
            <p className="mt-2 text-[14px] leading-6 text-slate-500">
              Your FreeSpace account is now active.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a href="carparking://verified"
                className="flex h-12 items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white active:bg-brand-600">
                Open FreeSpace app
              </a>
              <Link href="/"
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 text-[15px] font-semibold text-slate-700 active:bg-slate-50">
                Continue on web
              </Link>
            </div>
          </>
        ) : status === "error" ? (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
              <AlertTriangle className="h-8 w-8 text-rose-400" strokeWidth={1.75} />
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.03em] text-slate-900">Link expired</h1>
            <p className="mt-2 text-[14px] leading-6 text-slate-500">{error}</p>
            <Link href="/login" className="mt-6 inline-block text-[15px] font-semibold text-brand-600">Back to login</Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <Mail className="h-8 w-8 text-brand-500" strokeWidth={1.75} />
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.03em] text-slate-900">Verify your email</h1>
            <p className="mt-2 text-[14px] leading-6 text-slate-500">
              Confirm your email address to activate your account.
            </p>
            <button type="button" onClick={handleVerify} disabled={status === "loading"}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white active:bg-brand-600 disabled:opacity-60">
              {status === "loading" ? "Verifying…" : "Verify my email"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
