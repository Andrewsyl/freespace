"use client";

import Link from "next/link";
import { CheckCircle, CalendarCheck, Mail } from "lucide-react";
import { SlimNav } from "../../../components/SlimNav";

export default function BookingSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <SlimNav />
      <div className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center px-5 pb-16 pt-10">
        <div className="w-full max-w-sm">

          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-500 shadow-[0_8px_32px_rgba(22,163,74,0.30)]">
            <CheckCircle className="h-10 w-10 text-white" strokeWidth={1.75} />
          </div>

          {/* Heading */}
          <div className="text-center">
            <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Booking confirmed</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
              Your spot is reserved. You&apos;ll get a confirmation email shortly with all the details.
            </p>
          </div>

          {/* What's next */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-900">What&apos;s next</p>
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                  <Mail className="h-4 w-4 text-brand-600" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold text-slate-800">Check your email</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                    Confirmation and access instructions sent to your inbox.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                  <CalendarCheck className="h-4 w-4 text-brand-600" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold text-slate-800">View your booking</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                    Get directions, access details, and your host&apos;s contact in My bookings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-5 flex flex-col gap-3">
            <Link
              href="/bookings"
              className="flex h-12 items-center justify-center rounded-xl bg-brand-500 text-[15px] font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.99]"
            >
              View my booking
            </Link>
            <Link
              href="/"
              className="flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Find another space
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
