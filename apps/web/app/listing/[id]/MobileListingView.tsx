"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BoltIcon,
  CameraIcon,
  HomeIcon,
  KeyIcon,
  LockClosedIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import type { Listing } from "../../../components/ListingCard";
import { ListingMap } from "./MapSection";
import { trackEvent } from "../../../lib/telemetry";

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

function formatReviewDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function MobileListingView({
  listing,
  listingForMap,
  areaLabel,
  reviews,
  fallbackImage,
}: {
  listing: Listing & { amenities?: string[]; accessCode?: string | null };
  listingForMap: Listing;
  areaLabel: string;
  reviews: Review[];
  fallbackImage: string;
}) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("13:30");
  const [endTime, setEndTime] = useState("15:30");
  const [showBookingEditor, setShowBookingEditor] = useState(false);

  const href = `/checkout/${listing.id}?date=${date}&startTime=${startTime}&endTime=${endTime}`;
  const amenities = listing.amenities ?? [];
  const images = useMemo(() => listing.imageUrls ?? listing.image_urls ?? [fallbackImage], [fallbackImage, listing.imageUrls, listing.image_urls]);
  const heroImage = images[0] ?? fallbackImage;
  const selectedDateLabel = useMemo(
    () =>
      new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
    [date]
  );

  return (
    <div className="space-y-0 lg:hidden">
      {/* Hero image */}
      <div className="relative h-72 overflow-hidden bg-slate-200">
        <img src={heroImage} alt={listing.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Parking space</p>
          <h1 className="mt-1 max-w-[90%] text-[28px] font-semibold leading-[1.05] tracking-[-0.04em] text-white">
            {listing.title}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
            <MapPinIcon className="h-4 w-4 shrink-0" />
            {areaLabel}
          </p>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 border-b border-slate-200 bg-white">
        <div className="border-r border-slate-200 px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Price</p>
          <p className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-slate-950">
            {listing.pricePerDay ? `€${listing.pricePerDay}` : "-"}
          </p>
        </div>
        <div className="border-r border-slate-200 px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Rating</p>
          <p className="mt-1 flex items-center gap-1 text-[17px] font-semibold tracking-[-0.03em] text-slate-950">
            <StarIcon className="h-4 w-4 text-amber-500" />
            {listing.rating?.toFixed(1) ?? "5.0"}
          </p>
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Reviews</p>
          <p className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-slate-950">{listing.ratingCount ?? 0}</p>
        </div>
      </div>

      {/* Book this space */}
      <section className="border-b border-slate-200 bg-white px-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.04em] text-slate-950">Choose your time</h2>
          <button
            type="button"
            onClick={() => setShowBookingEditor((v) => !v)}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {showBookingEditor ? "Done" : "Change"}
          </button>
        </div>

        <div className="mt-4 border-b border-slate-100 pb-4">
          <p className="text-[13px] text-slate-400">{selectedDateLabel}</p>
          <p className="mt-0.5 text-[22px] font-semibold leading-tight tracking-[-0.03em] text-slate-950">
            {startTime} <span className="font-light text-slate-300">→</span> {endTime}
          </p>
        </div>

        {showBookingEditor && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">From</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Until</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500"
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500"
              />
            </label>
          </div>
        )}

        <Link
          href={href as any}
          onClick={() =>
            void trackEvent("web_booking_started", {
              listingId: listing.id,
              date,
              startTime,
              endTime,
            })
          }
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          Continue to booking
        </Link>

        <div className="mt-4 space-y-2 text-[13px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Exact location confirmed after booking
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Arrival instructions included with your confirmation
          </div>
        </div>
      </section>

      {/* About this space */}
      <section className="border-b border-slate-200 bg-white px-5 py-6">
        <h2 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.04em] text-slate-950">Space overview</h2>
        <p className="mt-4 text-[15px] leading-7 text-slate-600">{listing.availability}</p>
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
          <p className="text-sm font-semibold text-slate-950">Important notice</p>
          <p className="mt-1 text-[13px] leading-6 text-slate-600">
            Access details are shared after booking confirmation.
          </p>
        </div>
      </section>

      {/* Included features */}
      {amenities.length > 0 && (
        <section className="border-b border-slate-200 bg-white px-5 py-6">
          <h2 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.04em] text-slate-950">Included features</h2>
          <div className="mt-5 space-y-0">
            {amenities.slice(0, 6).map((amenity) => {
              const Icon = amenityToIcon(amenity);
              return (
                <div
                  key={amenity}
                  className="flex items-center gap-3 border-b border-slate-100 py-3.5 last:border-b-0"
                >
                  <Icon className="h-5 w-5 shrink-0 text-slate-400" />
                  <span className="text-[15px] text-slate-800">{amenity}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Local area */}
      {listing.latitude != null && listing.longitude != null && (
        <section className="border-b border-slate-200 bg-white px-5 py-6">
          <h2 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.04em] text-slate-950">The local area</h2>
          <div className="mt-4 h-56 overflow-hidden rounded-lg">
            <ListingMap listing={listingForMap} center={{ lat: listing.latitude, lng: listing.longitude }} zoom={14} />
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="bg-white px-5 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.04em] text-slate-950">Reviews</h2>
          <span className="text-[13px] text-slate-400">{reviews.length} total</span>
        </div>
        {reviews.length === 0 ? (
          <p className="mt-4 text-[15px] text-slate-600">No reviews yet.</p>
        ) : (
          <div className="mt-5 space-y-0">
            {reviews.slice(0, 4).map((review) => (
              <div key={review.id} className="border-b border-slate-100 py-5 last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <StarIcon className="h-4 w-4 text-amber-500" />
                    {Number(review.rating).toFixed(1)}
                  </div>
                  <span className="text-xs text-slate-400">
                    {formatReviewDate(review.createdAt ?? review.created_at)}
                  </span>
                </div>
                {review.comment && (
                  <p className="mt-2.5 text-[14px] leading-6 text-slate-600">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
