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
    <div className="space-y-5 lg:hidden">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="relative h-72 bg-slate-200">
          <img src={heroImage} alt={listing.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h1 className="max-w-[90%] text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] text-white">
              {listing.title}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/90">
              <MapPinIcon className="h-4 w-4" />
              {areaLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-slate-200 bg-white">
          <div className="border-r border-slate-200 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Price</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">{listing.pricePerDay ? `€${listing.pricePerDay}` : "-"}</p>
          </div>
          <div className="border-r border-slate-200 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rating</p>
            <p className="mt-1 flex items-center gap-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
              <StarIcon className="h-4 w-4 text-amber-500" />
              {listing.rating?.toFixed(1) ?? "5.0"}
            </p>
          </div>
          <div className="px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reviews</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">{listing.ratingCount ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Book this space</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">Choose your time</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowBookingEditor((value) => !value)}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {showBookingEditor ? "Done" : "Change"}
          </button>
        </div>

        <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Date</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{selectedDateLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Time</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {startTime} - {endTime}
              </p>
            </div>
          </div>
        </div>

        {showBookingEditor ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">From</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Until</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500"
                />
              </label>
            </div>
            <label className="mt-3 block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500"
              />
            </label>
          </>
        ) : null}

        <Link
          href={href as any}
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-brand-500 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
        >
          Continue to booking
        </Link>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">About this space</h2>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">{listing.availability}</p>
        {listing.accessCode && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Access details are shared after booking confirmation.
          </div>
        )}
      </section>

      {amenities.length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">Included features</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {amenities.slice(0, 6).map((amenity) => {
              const Icon = amenityToIcon(amenity);
              return (
                <div
                  key={amenity}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-brand-500">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{amenity}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {listing.latitude != null && listing.longitude != null && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">The local area</h2>
          <div className="mt-4 h-56 overflow-hidden rounded-[20px] border border-slate-200">
            <ListingMap listing={listingForMap} center={{ lat: listing.latitude, lng: listing.longitude }} zoom={14} />
          </div>
          <div className="mt-4">
            <WalkTime origin={{ lat: listing.latitude, lng: listing.longitude }} />
          </div>
        </section>
      )}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">Reviews</h2>
          <span className="text-sm font-semibold text-brand-500">{reviews.length} total</span>
        </div>
        {reviews.length === 0 ? (
          <p className="mt-3 text-[15px] text-slate-600">No reviews yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {reviews.slice(0, 4).map((review) => (
              <div key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <StarIcon className="h-4 w-4 text-amber-500" />
                    {Number(review.rating).toFixed(1)}
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatReviewDate(review.createdAt ?? review.created_at)}
                  </span>
                </div>
                {review.comment ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{review.comment}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
