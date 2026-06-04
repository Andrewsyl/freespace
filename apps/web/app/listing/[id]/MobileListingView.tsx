"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Zap, Camera, Home, Key, Lock, MapPin, ShieldCheck, Star, Truck } from "lucide-react";
import type { Listing } from "../../../components/ListingCard";
import { ListingMap } from "./MapSection";
import { trackEvent } from "../../../lib/telemetry";
import { SearchDateTimePicker } from "../../../components/SearchForm";
import { calculateListingTotal, formatPriceValue } from "../../../lib/pricing";

type Review = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

function amenityToIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("ev") || normalized.includes("charger")) return Zap;
  if (normalized.includes("cctv") || normalized.includes("camera")) return Camera;
  if (normalized.includes("covered") || normalized.includes("roof") || normalized.includes("shelter")) return Home;
  if (normalized.includes("gated") || normalized.includes("barrier") || normalized.includes("gate")) return Lock;
  if (normalized.includes("permit") || normalized.includes("secure")) return ShieldCheck;
  if (normalized.includes("code") || normalized.includes("key")) return Key;
  if (normalized.includes("van") || normalized.includes("large")) return Truck;
  return ShieldCheck;
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
  distanceKm,
  initialBooking,
}: {
  listing: Listing & { amenities?: string[]; accessCode?: string | null };
  listingForMap: Listing;
  areaLabel: string;
  reviews: Review[];
  fallbackImage: string;
  distanceKm?: number;
  initialBooking?: {
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
  };
}) {
  const router = useRouter();
  const defaultStart = useMemo(() => {
    if (initialBooking?.startDate && initialBooking?.startTime) {
      return new Date(`${initialBooking.startDate}T${initialBooking.startTime}:00`);
    }
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d;
  }, [initialBooking?.startDate, initialBooking?.startTime]);
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(() => {
    if (initialBooking?.endDate && initialBooking?.endTime) {
      const parsed = new Date(`${initialBooking.endDate}T${initialBooking.endTime}:00`);
      if (parsed.getTime() > defaultStart.getTime()) {
        return parsed;
      }
    }
    return new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000);
  });

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const toTimeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const href = `/checkout/${listing.id}?date=${toDateStr(startAt)}&startTime=${toTimeStr(startAt)}&endDate=${toDateStr(endAt)}&endTime=${toTimeStr(endAt)}`;
  const bookingTotal = useMemo(() => calculateListingTotal(listing, startAt, endAt), [listing, startAt, endAt]);
  const amenities = listing.amenities ?? [];
  const images = useMemo(
    () => listing.imageUrls ?? listing.image_urls ?? [fallbackImage],
    [fallbackImage, listing.imageUrls, listing.image_urls],
  );
  const heroImage = images[0] ?? fallbackImage;
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);

  return (
    <>
      {/* ── Scrollable body ── */}
      <div
        className="space-y-0 lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
      >
        {/* ── Hero image ── */}
        <div className="relative h-80 overflow-hidden bg-slate-200">
          <button
            type="button"
            onClick={() => setIsImageFullscreen(true)}
            className="absolute inset-0 z-0"
            aria-label="Open image fullscreen"
          >
            <img src={heroImage} alt={listing.title} className="h-full w-full object-cover" />
          </button>
          {/* Gradient scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/20" />

          {/* Back button */}
          <button
            type="button"
            onClick={() => router.back()}
            className="absolute left-4 top-safe flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm"
            style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
          >
            <svg className="h-5 w-5 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Rating badge */}
          {listing.rating != null && reviews.length > 0 && (
            <div
              className="absolute right-4 rounded-full bg-black/70 px-3 py-1 backdrop-blur-sm"
              style={{ top: "calc(env(safe-area-inset-top) + 14px)" }}
            >
              <span className="text-[13px] font-bold text-white">
                ★ {listing.rating.toFixed(1)}
              </span>
            </div>
          )}

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Parking space
            </p>
            <h1 className="mt-1 max-w-[90%] text-[26px] font-bold leading-[1.05] tracking-[-0.03em] text-white">
              {listing.title}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-white/80">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {areaLabel}
            </p>
          </div>
        </div>

        {/* ── Quick stats bar ── */}
        <div className={`grid divide-x divide-slate-200 border-b border-slate-200 bg-white ${distanceKm != null ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="flex flex-col justify-center px-3 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Price</p>
            <p className="mt-1 text-[17px] font-bold tracking-[-0.03em] text-slate-950">
              €{formatPriceValue(bookingTotal.total)}{" "}
              <span className="text-[10px] font-medium text-slate-600">{bookingTotal.durationLabel}</span>
            </p>
          </div>
          <div className="flex flex-col justify-center px-3 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Rating</p>
            <p className="mt-1 flex items-baseline gap-1 text-[17px] font-bold tracking-[-0.03em] text-slate-950">
              <Star className="h-4 w-4 translate-y-[1px] text-amber-400" />
              {reviews.length > 0 ? listing.rating?.toFixed(1) : "0.0"}
              {reviews.length === 0 && (
                <span className="text-[10px] font-medium text-slate-600">New</span>
              )}
            </p>
          </div>
          {distanceKm != null && (
            <div className="flex flex-col justify-center px-3 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Distance</p>
              <p className="mt-1 text-[17px] font-bold tracking-[-0.03em] text-slate-950">
                {distanceKm.toFixed(1)}<span className="text-[11px] font-medium text-slate-600"> km</span>
              </p>
            </div>
          )}
        </div>

        {/* ── Choose your time ── */}
        <section className="border-b border-slate-200 bg-white px-5 py-6">
          <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">
            Choose your time
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SearchDateTimePicker
              label="From"
              value={startAt}
              portalPopup
              onChange={(next) => {
                setStartAt(next);
                if (next >= endAt) setEndAt(new Date(next.getTime() + 2 * 60 * 60 * 1000));
              }}
            />
            <SearchDateTimePicker
              label="Until"
              value={endAt}
              portalPopup
              onChange={(next) => {
                if (next > startAt) setEndAt(next);
              }}
            />
          </div>
          <div className="mt-4 space-y-2">
            {[
              "Exact location confirmed after booking",
              "Arrival instructions included with your confirmation",
            ].map((note) => (
              <div key={note} className="flex items-center gap-2.5 text-[13px] text-slate-600">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {note}
              </div>
            ))}
          </div>
        </section>

        {/* ── Space overview ── */}
        {listing.availability && (
          <section className="border-b border-slate-200 bg-white px-5 py-6">
            <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">About this space</h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">{listing.availability}</p>
          </section>
        )}

        {/* ── Features ── */}
        {amenities.length > 0 && (
          <section className="border-b border-slate-200 bg-white px-5 py-6">
            <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Features</h2>
            <div className="mt-4">
              {amenities.slice(0, 6).map((amenity) => {
                const Icon = amenityToIcon(amenity);
                return (
                  <div
                    key={amenity}
                    className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50">
                      <Icon className="h-4 w-4 text-brand-600" />
                    </div>
                    <span className="text-[14px] font-medium text-slate-800">{amenity}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Location map ── */}
        {listing.latitude != null && listing.longitude != null && (
          <section className="border-b border-slate-200 bg-white px-5 py-6">
            <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Location</h2>
            <div className="mt-4 h-52 overflow-hidden rounded-2xl">
              <ListingMap
                listing={listingForMap}
                center={{ lat: listing.latitude, lng: listing.longitude }}
                zoom={14}
              />
            </div>
          </section>
        )}

        {/* ── Reviews ── */}
        <section className="bg-white px-5 py-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Reviews</h2>
            {reviews.length > 0 && (
              <span className="text-[12px] font-medium text-slate-600">{reviews.length} total</span>
            )}
          </div>
          {reviews.length === 0 ? (
            <p className="mt-3 text-[13px] text-slate-600">No reviews yet.</p>
          ) : (
            <div className="mt-4">
              {reviews.slice(0, 4).map((review) => (
                <div key={review.id} className="border-b border-slate-100 py-4 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < Math.round(review.rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-600">
                      {formatReviewDate(review.createdAt ?? review.created_at)}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-[13px] leading-[1.6] text-slate-600">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Sticky booking footer ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 bg-white px-4 shadow-[0_-4px_20px_rgba(15,23,42,0.10)] lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)", paddingTop: "12px" }}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-[11px] font-semibold text-slate-600">{bookingTotal.durationLabel}</p>
            <p className="text-[20px] font-extrabold tracking-tight text-slate-900">
              €{formatPriceValue(bookingTotal.total)}
            </p>
          </div>
          <Link
            href={href as any}
            onClick={() =>
              void trackEvent("web_booking_started", {
                listingId: listing.id,
                date: toDateStr(startAt),
                startTime: toTimeStr(startAt),
                endTime: toTimeStr(endAt),
              })
            }
            className="flex flex-1 items-center justify-center rounded-2xl bg-brand-500 py-3.5 text-[15px] font-bold text-white shadow-sm transition active:bg-brand-600"
          >
            Book now
          </Link>
        </div>
      </div>

      {isImageFullscreen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 lg:hidden">
          <button
            type="button"
            onClick={() => setIsImageFullscreen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm"
            style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
            aria-label="Close fullscreen image"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setIsImageFullscreen(false)}
            className="absolute inset-0"
            aria-label="Close fullscreen image backdrop"
          />
          <img
            src={heroImage}
            alt={listing.title}
            className="relative z-10 max-h-[100dvh] w-full object-contain"
          />
        </div>
      )}
    </>
  );
}
