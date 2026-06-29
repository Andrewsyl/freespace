"use client";

import Link from "next/link";

// Shown in place of the booking widget when the signed-in viewer owns this
// listing. Hosts reach their own public page via the dashboard "Preview"
// button (or a shared link), where booking makes no sense — the API also
// rejects self-bookings, so this is the matching front-of-house treatment.
export function OwnerListingNotice({ listingId }: { listingId: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 shrink-0 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <h3 className="text-[16px] font-bold tracking-[-0.01em] text-slate-950">This is your listing</h3>
      </div>
      <p className="mt-2 text-[13.5px] leading-[1.6] text-slate-600">
        You&apos;re seeing your space the way drivers do. You can&apos;t book your own listing — manage it instead.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href={`/host/edit/${listingId}` as any}
          className="flex items-center justify-center rounded-2xl bg-slate-900 py-3 text-[14px] font-bold text-white transition hover:bg-slate-800"
        >
          Edit listing
        </Link>
        <Link
          href={"/host/dashboard" as any}
          className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-3 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
