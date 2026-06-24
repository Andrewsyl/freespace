"use client";
import { Lightbulb } from "lucide-react";

import type { HostStepProps } from "./types";
import { prettySpaceType } from "./utils";
import { SectionLabel, TipCallout } from "./_ui";
import { ListingPreviewCard } from "./ListingPreviewCard";

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
    <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
      <dt className="w-24 shrink-0 text-[13px] font-medium text-slate-400">{label}</dt>
      <dd className={`flex-1 text-[14px] ${missing ? "italic text-slate-400" : "font-semibold text-slate-900"}`}>
        {value || (missing ? "Not set" : "—")}
      </dd>
    </div>
  );
}

export function HostConfirmationStep({ data }: HostStepProps) {
  const spaceCount = parseInt(data.spaceCount ?? "0", 10) || 0;
  const photos = data.imageUrls.length;

  // ── Listing quality score ──
  const checks = [
    { ok: !!data.locationConfirmed, tip: null as string | null },
    { ok: !!data.spaceType && spaceCount > 0 && !!data.vehicleSize, tip: null as string | null },
    { ok: !!(data.pricePerDay || data.pricePerHour || data.pricePerMonth), tip: null as string | null },
    {
      ok: data.amenities.length >= 2,
      tip: "Highlight a few features so drivers know what to expect",
    },
    {
      ok: photos >= 3,
      tip: photos === 0
        ? "Add at least one photo — listings with photos get far more bookings"
        : "Add more photos (aim for 3+) to stand out in search",
    },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const pct = Math.round((passed / checks.length) * 100);
  const strength = pct >= 80 ? "Strong" : pct >= 60 ? "Good" : "Basic";
  const strong = pct >= 80;
  const tips = checks.filter((c) => !c.ok && c.tip).map((c) => c.tip!);

  return (
    <div className="space-y-10">

      {/* Almost-done moment */}
      <p className="text-[16px] font-semibold leading-relaxed text-slate-700">
        {strong
          ? "Your listing is looking great — you're one tap from going live. 🎉"
          : "You're almost there. A couple of quick additions will help you get booked faster."}
      </p>

      {/* Live preview */}
      <div>
        <SectionLabel>How drivers will see it</SectionLabel>
        <div className="mt-4">
          <ListingPreviewCard data={data} />
        </div>
      </div>

      {/* Listing strength */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-700">Listing strength</p>
          <p className={`text-[13px] font-bold ${strong ? "text-brand-700" : "text-slate-700"}`}>{strength}</p>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {tips.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {tips.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" strokeWidth={2} />
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Full details */}
      <div>
        <SectionLabel>Listing details</SectionLabel>
        <dl className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-1">
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

      {/* Publish reassurance */}
      <TipCallout title="Ready to go live?">
        Your listing appears on the map as soon as you publish. You can edit, pause, or remove it any time from your host dashboard.
      </TipCallout>
    </div>
  );
}
