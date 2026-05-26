"use client";

import type { HostStepProps } from "./types";
import { buildTitleFromDraft, prettySpaceType } from "./utils";

const VEHICLE_LABELS: Record<string, string> = {
  small:  "Small",
  medium: "Medium",
  large:  "Large",
  van:    "Van",
};

const ACCESS_TYPE_LABELS: Record<string, string> = {
  key_fob:               "Key / security fob",
  pin_code:              "Pin code",
  special_instructions:  "Special instructions",
};

function Row({ label, value, missing }: { label: string; value?: string | null; missing?: boolean }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`flex-1 text-sm ${missing ? "italic text-slate-400" : "font-medium text-slate-900"}`}>
        {value || (missing ? "Not set" : "—")}
      </dd>
    </div>
  );
}

export function HostConfirmationStep({ data }: HostStepProps) {
  const spaceCount = parseInt(data.spaceCount ?? "0", 10) || 0;

  return (
    <div className="space-y-4">
      {/* Photos strip */}
      {data.imageUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.imageUrls.map((url, idx) => (
            <div key={url + idx} className="h-28 w-44 shrink-0 overflow-hidden rounded-2xl border border-slate-200">
              <img src={url} alt="Listing" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Your listing</p>
        <dl>
          <Row label="Address"    value={data.address}                          missing={!data.address} />
          <Row label="Space type" value={data.spaceType ? prettySpaceType(data.spaceType) : undefined} missing={!data.spaceType} />
          {spaceCount > 0 && (
            <Row label="Spaces"   value={`${spaceCount} space${spaceCount > 1 ? "s" : ""}`} />
          )}
          {data.vehicleSize && (
            <Row label="Vehicle"  value={VEHICLE_LABELS[data.vehicleSize] ?? data.vehicleSize} />
          )}
          <Row label="Price"       value={data.pricePerDay ? `€${data.pricePerDay} per day` : undefined} missing={!data.pricePerDay} />
          {typeof data.pricePerMonth === "number" && data.pricePerMonth > 0 ? (
            <Row label="Monthly" value={`€${data.pricePerMonth} per month`} />
          ) : null}
          <Row label="Available"   value={data.availabilityText || undefined}   missing={!data.availabilityText} />
          {data.requiresAccessCode === true && data.accessType && (
            <Row label="Access"    value={ACCESS_TYPE_LABELS[data.accessType] ?? data.accessType} />
          )}
          {data.requiresAccessCode === true && data.accessInstructions && (
            <Row label="Details"   value={data.accessInstructions} />
          )}
          {data.requiresAccessCode === false && (
            <Row label="Access"    value="No special access required" />
          )}
        </dl>
      </div>

      {/* Amenities */}
      {data.amenities.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Features</p>
          <div className="flex flex-wrap gap-2">
            {data.amenities.map((item) => (
              <span key={item} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No photos nudge */}
      {data.imageUrls.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-xs text-slate-500">No photos added — go back to add some for better conversion.</p>
        </div>
      )}

      {/* Publish callout */}
      <div className="rounded-2xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-100">
        <p className="text-sm font-semibold text-emerald-900">Ready to go live?</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-700">
          Your listing will appear on the map immediately. You can edit details, pause, or remove it anytime from your host dashboard.
        </p>
      </div>
    </div>
  );
}
