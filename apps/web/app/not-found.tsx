import Link from "next/link";
import { Compass, Search, ArrowRight } from "lucide-react";
import { SlimNav } from "../components/SlimNav";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50">
      <SlimNav />
      <div className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center px-5 pb-16 pt-10">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.25)]">
            <Compass className="h-8 w-8 text-brand-500" strokeWidth={1.75} />
          </div>
          <h1 className="text-[24px] font-bold tracking-[-0.02em] text-slate-900">This page took a wrong turn</h1>
          <p className="mt-2 text-[14.5px] leading-[1.6] text-slate-500">
            The page or space you&apos;re after isn&apos;t here — it may have been removed or the link has expired. Let&apos;s get you parked instead.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <Link
              href="/"
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 text-[15px] font-bold text-white shadow-sm transition hover:bg-brand-600"
            >
              <Search className="h-4 w-4" strokeWidth={2.5} /> Find parking near you
            </Link>
            <Link
              href="/bookings"
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              My bookings <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
