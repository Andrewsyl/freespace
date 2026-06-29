"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SlimNav } from "../../../components/SlimNav";

export default function BookingCancelPage() {
  return (
    <div className="min-h-screen bg-white">
      <SlimNav />
      <div className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-8 w-8 text-amber-500" strokeWidth={1.75} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Booking cancelled</p>
          <h1 className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Payment not completed</h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-600">
            No charge was made and your space wasn&apos;t reserved. You can pick up where you left off, try a different time, or check your existing bookings.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/"
              className="flex h-12 items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white active:bg-brand-600">
              Search again
            </Link>
            <Link href="/bookings"
              className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 text-[15px] font-semibold text-slate-700 active:bg-slate-50">
              My bookings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
