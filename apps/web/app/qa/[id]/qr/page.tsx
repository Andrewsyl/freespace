"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getListing, type ListingDetail } from "../../../../lib/api";

export default function QaPortalQrPage() {
  const params = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    const listingId = params?.id;
    if (!listingId) return;
    getListing(listingId)
      .then(setListing)
      .catch(() => setError("Could not load parking location"));
  }, [params?.id]);

  const qrUrl = useMemo(() => {
    if (!origin || !listing) return "";
    return `${origin}/qa/${listing.id}`;
  }, [origin, listing]);

  if (error) {
    return <div className="mx-auto max-w-xl px-4 py-10 text-sm text-rose-600">{error}</div>;
  }

  if (!listing) {
    return <div className="mx-auto max-w-xl px-4 py-10 text-sm text-slate-600">Loading QR…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 print:py-0">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Driver QR</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{listing.title}</h1>
        <p className="text-sm text-slate-600">{listing.address}</p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrUrl)}`}
            alt={`QR code for ${listing.title}`}
            className="h-64 w-64 rounded-xl border border-slate-200 bg-white p-2"
          />
          <p className="text-sm font-semibold text-slate-700">Scan to pay for parking</p>
          <p className="break-all text-xs text-slate-500">{qrUrl}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <a
          href={`/qa/${listing.id}`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Open portal
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Print QR
        </button>
      </div>
    </div>
  );
}
