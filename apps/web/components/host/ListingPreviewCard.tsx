"use client";

import { MapPin, Star, ShieldCheck } from "lucide-react";
import type { HostListingDraft } from "./types";
import { buildTitleFromDraft, prettySpaceType } from "./utils";

function priceLabel(d: HostListingDraft): { amount: number; unit: string } | null {
  if (d.pricePerDay)   return { amount: d.pricePerDay,   unit: "day" };
  if (d.pricePerHour)  return { amount: d.pricePerHour,  unit: "hr" };
  if (d.pricePerMonth) return { amount: d.pricePerMonth, unit: "mo" };
  return null;
}

/** A faithful preview of how a driver will see this listing in search. */
export function ListingPreviewCard({ data, className = "" }: { data: HostListingDraft; className?: string }) {
  const cover  = data.imageUrls[0];
  const title  = buildTitleFromDraft(data);
  const parts  = (data.address ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const area   = parts.slice(1).join(", ") || parts[0] || "Your area";
  const price  = priceLabel(data);
  const spaces = parseInt(data.spaceCount ?? "0", 10) || 0;
  const features = data.amenities.slice(0, 3);

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {/* Media */}
      <div className="relative aspect-[16/10] w-full bg-slate-100">
        {cover ? (
          <img src={cover} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <MapPin className="h-7 w-7" strokeWidth={1.6} />
            <span className="text-[12px] font-medium">Photo preview</span>
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-900 shadow-sm backdrop-blur">
          New listing
        </span>

        {price && (
          <span className="absolute bottom-3 left-3 rounded-full bg-slate-900/85 px-3 py-1.5 text-[13px] font-bold text-white backdrop-blur">
            €{price.amount}
            <span className="font-medium text-white/80"> / {price.unit}</span>
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-bold leading-snug text-slate-900">{title}</p>
          <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[13px] font-semibold text-slate-500">
            <Star className="h-3.5 w-3.5 fill-slate-300 text-slate-300" /> New
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-slate-500">{area}</p>
        <p className="mt-1 text-[13px] text-slate-500">
          {prettySpaceType(data.spaceType)}
          {spaces > 0 ? ` · ${spaces} space${spaces > 1 ? "s" : ""}` : ""}
        </p>

        {features.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {features.map((f) => (
              <span key={f} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-medium text-slate-600">
                {f}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[12px] font-medium text-slate-500">
          <ShieldCheck className="h-4 w-4 text-brand-600" strokeWidth={2} />
          Protected by FreeSpace host cover
        </div>
      </div>
    </div>
  );
}
