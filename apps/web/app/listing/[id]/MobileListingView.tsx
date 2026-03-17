"use client";

import { useMemo, useState } from "react";
import { MapPinIcon, StarIcon } from "@heroicons/react/24/solid";
import {
  BoltIcon,
  CameraIcon,
  HomeIcon,
  KeyIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import type { Listing } from "../../../components/ListingCard";
import { ListingMap } from "./MapSection";
import { WalkTime } from "./WalkTime";

type Review = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

function amenityToIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("ev") || normalized.includes("charger")) return BoltIcon;
  if (normalized.includes("cctv") || normalized.includes("camera")) return CameraIcon;
  if (normalized.includes("covered") || normalized.includes("roof") || normalized.includes("shelter")) return HomeIcon;
  if (normalized.includes("gated") || normalized.includes("barrier") || normalized.includes("gate")) return LockClosedIcon;
  if (normalized.includes("permit") || normalized.includes("secure")) return ShieldCheckIcon;
  if (normalized.includes("code") || normalized.includes("key")) return KeyIcon;
  if (normalized.includes("van") || normalized.includes("large")) return TruckIcon;
  return ShieldCheckIcon;
}

export function MobileListingView({
  listing,
  listingForMap,
  areaLabel,
  reviews,
}: {
  listing: Listing & { amenities?: string[]; accessCode?: string | null };
  listingForMap: Listing;
  areaLabel: string;
  reviews: Review[];
}) {
  const [active, setActive] = useState<"overview" | "reviews" | "how">("overview");
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("00:00");

  const href = `/checkout/${listing.id}?date=${date}&startTime=${startTime}&endTime=${endTime}`;
  const reviewCount = reviews.length;
  const amenities = listing.amenities ?? [];
  const images = useMemo(() => listing.imageUrls ?? listing.image_urls ?? [], [listing.imageUrls, listing.image_urls]);

  const tabClass = (key: typeof active) =>
    `flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition ${
      active === key
        ? "bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.15)]"
        : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <div className="lg:hidden font-display text-[#0f172a]">
      <section className="rounded-[22px] border border-white/70 bg-white/95 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.12)] ring-1 ring-black/5 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{listing.title}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-[#6b7280]">
              <MapPinIcon className="h-4 w-4 text-brand-500" />
              {areaLabel}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 shadow-sm">
            <StarIcon className="h-4 w-4 text-amber-500" />
            {listing.rating?.toFixed(1) ?? "5.0"}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-700">
          <div className="rounded-[14px] border border-emerald-100/60 bg-emerald-50/60 px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6b7280]">Enter after</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{startTime}</p>
          </div>
          <div className="rounded-[14px] border border-emerald-100/60 bg-emerald-50/60 px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6b7280]">Exit before</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{endTime}</p>
          </div>
          <div className="rounded-[14px] border border-slate-200/70 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6b7280]">Booking price</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">€{listing.pricePerDay}</p>
          </div>
          <div className="rounded-[14px] border border-slate-200/70 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6b7280]">To destination</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Select</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-[16px] border border-slate-200/70 bg-slate-50/70 p-2 shadow-inner">
          <button type="button" className={tabClass("overview")} onClick={() => setActive("overview")}>
            Overview
          </button>
          <button type="button" className={tabClass("reviews")} onClick={() => setActive("reviews")}>
            Reviews {reviewCount > 0 ? `(${reviewCount})` : ""}
          </button>
          <button type="button" className={tabClass("how")} onClick={() => setActive("how")}>
            How to park
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {active === "overview" && (
            <>
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {images.slice(0, 2).map((img, idx) => (
                    <div key={`${img}-${idx}`} className="h-24 overflow-hidden rounded-[16px] border border-white/60 shadow-sm">
                      <img src={img} alt={`${listing.title} ${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="flex items-center gap-2 text-sm font-semibold text-[#2ECC8F]"
                onClick={() => setActive("how")}
              >
                Open Street View →
              </button>

              <p className="text-sm text-[#6b7280]">{listing.availability}</p>

              <a
                href={href}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-[#2ECC8F] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(16,185,129,0.25)] transition hover:-translate-y-0.5 hover:bg-emerald-600"
              >
                Book now securely
              </a>
            </>
          )}

          {active === "reviews" && (
            <>
              {reviewCount === 0 ? (
                <p className="text-sm text-[#6b7280]">No reviews yet.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.slice(0, 6).map((review) => (
                    <div key={review.id} className="rounded-[14px] border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          <StarIcon className="h-4 w-4 text-amber-500" />
                          {Number(review.rating).toFixed(1)}
                        </div>
                        <span className="text-xs text-[#6b7280]">
                          {new Date(review.createdAt ?? review.created_at ?? "").toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      {review.comment && <p className="mt-2 text-sm text-slate-600">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {active === "how" && (
            <>
              <div className="grid gap-3">
                <label className="text-xs font-semibold text-[#6b7280]">Enter after</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none"
                />
                <label className="text-xs font-semibold text-[#6b7280]">Exit before</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none"
                />
                <label className="text-xs font-semibold text-[#6b7280]">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none"
                />
              </div>

              {amenities.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {amenities.slice(0, 6).map((amenity) => {
                    const Icon = amenityToIcon(amenity);
                    return (
                      <div key={amenity} className="flex items-center gap-3 rounded-[14px] border border-[#e5e7eb] bg-white px-3 py-2 shadow-sm">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ecfdf5] text-[#2ECC8F]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-xs font-semibold text-slate-700">{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {listing.latitude != null && listing.longitude != null && (
                <div className="pt-2">
                  <div className="h-48 overflow-hidden rounded-[14px]">
                    <ListingMap listing={listingForMap} center={{ lat: listing.latitude, lng: listing.longitude }} zoom={14} />
                  </div>
                  <div className="mt-3">
                    <WalkTime origin={{ lat: listing.latitude, lng: listing.longitude }} />
                  </div>
                </div>
              )}

              {listing.accessCode && (
                <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  Access code is shared after booking confirmation.
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
