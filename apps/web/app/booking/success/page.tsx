"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle } from "lucide-react";
import { SlimNav } from "../../../components/SlimNav";

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-white"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
      <BookingSuccessContent />
    </Suspense>
  );
}

function BookingSuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <div className="min-h-screen bg-white">
      <SlimNav />
      <div className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <CheckCircle className="h-8 w-8 text-brand-500" strokeWidth={1.75} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Booking confirmed</p>
          <h1 className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Payment successful</h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-500">
            Your booking is confirmed. You&apos;ll find it in your dashboard shortly.
          </p>
          {sessionId && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500">
              Session: <span className="font-semibold text-slate-700">{sessionId}</span>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/dashboard"
              className="flex h-12 items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white active:bg-brand-600">
              View dashboard
            </Link>
            <Link href="/"
              className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 text-[15px] font-semibold text-slate-700 active:bg-slate-50">
              Find another space
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
