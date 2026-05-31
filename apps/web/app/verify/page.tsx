"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { verifyEmail } from "../../lib/api";

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-white"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
      <VerifyPageContent />
    </Suspense>
  );
}

function VerifyPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("Missing token."); return; }
    verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Email verified!");
        setTimeout(() => router.push("/dashboard"), 1500);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed.");
      });
  }, [token, router]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-5 pb-10">
      <div className="w-full max-w-sm text-center">
        <img src="/freespace-logo.png" alt="FreeSpace" className="mx-auto mb-8 h-10 w-auto mix-blend-multiply" />

        {status === "loading" && (
          <>
            <div className="mx-auto mb-5 h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="text-[15px] text-slate-500">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <CheckCircle className="h-8 w-8 text-brand-500" strokeWidth={1.75} />
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.03em] text-slate-900">All set</h1>
            <p className="mt-2 text-[14px] text-slate-500">{message} Redirecting…</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
              <AlertTriangle className="h-8 w-8 text-rose-400" strokeWidth={1.75} />
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.03em] text-slate-900">Verification failed</h1>
            <p className="mt-2 text-[14px] text-slate-500">{message}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/login"
                className="flex h-12 items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white">
                Back to login
              </Link>
              <Link href="/dashboard"
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 text-[15px] font-semibold text-slate-700">
                Go to dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
