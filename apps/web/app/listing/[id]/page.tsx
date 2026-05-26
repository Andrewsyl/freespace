import { notFound } from "next/navigation";
import { StarIcon } from "@heroicons/react/24/solid";
import {
  BoltIcon,
  CameraIcon,
  HomeIcon,
  KeyIcon,
  LockClosedIcon,
  MapPinIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { getListing, listListingReviews } from "../../../lib/api";
import { getListingRateType, getListingUnitPrice } from "../../../lib/pricing";
import type { Listing } from "../../../components/ListingCard";
import { ListingMap } from "./MapSection";
import { SlimNav } from "../../../components/SlimNav";
import { MobileListingView } from "./MobileListingView";
import { SidebarBookingCard } from "./SidebarBookingCard";

function fallbackImage(title: string) {
  const encoded = encodeURIComponent(title);
  return `https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1600&q=80&sat=-15&title=${encoded}`;
}

function formatReviewDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function amenityToIcon(label: string) {
  const n = label.toLowerCase();
  if (n.includes("ev") || n.includes("charger")) return BoltIcon;
  if (n.includes("cctv") || n.includes("camera")) return CameraIcon;
  if (n.includes("covered") || n.includes("roof") || n.includes("shelter")) return HomeIcon;
  if (n.includes("gated") || n.includes("barrier") || n.includes("gate")) return LockClosedIcon;
  if (n.includes("permit") || n.includes("secure")) return ShieldCheckIcon;
  if (n.includes("code") || n.includes("key")) return KeyIcon;
  if (n.includes("van") || n.includes("large")) return TruckIcon;
  return ShieldCheckIcon;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          className={`h-3.5 w-3.5 ${n <= Math.round(rating) ? "text-amber-400" : "text-slate-200"}`}
        />
      ))}
    </span>
  );
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const [listing, reviews] = await Promise.all([
    getListing(id).catch(() => null),
    listListingReviews(id).catch(() => []),
  ]);
  if (!listing) notFound();

  const listingForMap: Listing = {
    ...listing,
    distanceKm: 0,
    availability: listing.availability,
    pricePerDay: listing.pricePerDay,
    rating: listing.rating ?? 5,
    ratingCount: listing.ratingCount ?? 0,
  };

  const fallback =
    listing.latitude != null &&
    listing.longitude != null &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? `https://maps.googleapis.com/maps/api/streetview?size=1200x800&location=${listing.latitude},${listing.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      : fallbackImage(listing.title);

  const images = listing.imageUrls && listing.imageUrls.length ? listing.imageUrls : [fallback];
  const rateLabel = getListingRateType(listing) === "hourly" ? "/ hr" : "/ day";
  const unitPrice = getListingUnitPrice(listing);
  const hasCoords = listing.latitude != null && listing.longitude != null;
  const rating = listing.rating ?? 5;
  const ratingCount = listing.ratingCount ?? 0;
  const streetViewHref = hasCoords
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${listing.latitude},${listing.longitude}`
    : undefined;

  // Gallery slots — fill missing slots from first image
  const slots = [0, 1, 2, 3, 4].map((i) => images[i] ?? images[0]);

  return (
    <div className="min-h-screen bg-white">
      <SlimNav />

      {/* ── Mobile ── */}
      <div className="mx-auto max-w-6xl px-4 py-8 lg:hidden">
        <MobileListingView
          listing={listing}
          listingForMap={listingForMap}
          areaLabel={listing.address}
          reviews={reviews as any}
          fallbackImage={fallback}
        />
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-6xl px-6 pt-5">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-slate-400">
            <a href="/search" className="transition hover:text-slate-600">Find parking</a>
            <span>/</span>
            <a href="/search" className="transition hover:text-slate-600">
              {listing.address.split(",").slice(-2).join(",").trim()}
            </a>
            <span>/</span>
            <span className="text-slate-600">{listing.title}</span>
          </nav>

          {/* Title bar */}
          <div className="mt-5 flex items-start justify-between gap-8">
            <div className="min-w-0">
              <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-slate-950">
                <span className="text-brand-500">Parking at </span>{listing.title}
              </h1>
              <div className="mt-1.5 flex items-center gap-1.5 text-[15px] text-slate-500">
                <MapPinIcon className="h-4 w-4 shrink-0 text-slate-400" />
                {listing.address}
              </div>
              <div className="mt-2 flex items-center gap-2.5 text-[13px] text-slate-500">
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <StarIcon className="h-4 w-4 text-amber-400" />
                  {rating.toFixed(1)}
                </span>
                {ratingCount > 0 && <span>· {ratingCount} reviews</span>}
                <span>·</span>
                <span>Hosted on carpark</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v14"/>
                </svg>
                Share
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                Save
              </button>
            </div>
          </div>

          {/* Hero map */}
          {hasCoords ? (
            <div className="relative mt-4 h-[460px] overflow-hidden rounded-2xl">
              <div className="h-full w-full">
                <ListingMap
                  listing={listingForMap}
                  center={{ lat: listing.latitude!, lng: listing.longitude! }}
                  zoom={14}
                />
              </div>

              {/* Map view tabs — top-left */}
              <div className="absolute left-4 top-4 flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {(["Map", "Satellite", "Street view"] as const).map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={`px-3.5 py-2 text-[13px] font-semibold transition ${
                      i === 0
                        ? "bg-white text-brand-600"
                        : "border-l border-slate-200 text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Zoom controls — top-right */}
              <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <button type="button" aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center border-b border-slate-200 text-[18px] font-bold leading-none text-slate-700 transition hover:bg-slate-50">+</button>
                <button type="button" aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center text-[18px] font-bold leading-none text-slate-700 transition hover:bg-slate-50">−</button>
              </div>

              {/* Address card — bottom-left */}
              <div className="absolute bottom-4 left-4 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.14)]">
                <div className="flex items-start gap-3 px-4 pb-2.5 pt-3.5">
                  <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500 ring-[3px] ring-brand-100" />
                  <div>
                    <p className="text-[14px] font-semibold leading-tight text-slate-900">
                      {listing.address.split(",")[0]}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-400">Exact address shared after booking</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                  <span className="font-mono text-[13px] font-semibold text-slate-700">€{unitPrice} {rateLabel}</span>
                  {streetViewHref && (
                    <a href={streetViewHref} target="_blank" rel="noreferrer" className="ml-4 text-[12px] font-semibold text-brand-500 transition hover:text-brand-600">
                      Directions →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Fallback: image gallery when no coords */
            images.length === 1 ? (
              <div className="relative mt-4 h-[460px] overflow-hidden rounded-2xl bg-slate-100">
                <img src={images[0]} alt={listing.title} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div
                className="relative mt-4 grid overflow-hidden rounded-2xl"
                style={{ gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "220px 220px", gap: "8px" }}
              >
                <div className="row-span-2 overflow-hidden bg-slate-100">
                  <img src={slots[0]} alt={listing.title} className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]" />
                </div>
                {slots.slice(1).map((img, i) => (
                  <div key={i} className="overflow-hidden bg-slate-100">
                    <img src={img} alt={`${listing.title} ${i + 2}`} className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]" />
                  </div>
                ))}
                <button type="button" className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                  Show all photos
                </button>
              </div>
            )
          )}

          {/* Two-column body */}
          <div className="mt-10 grid grid-cols-[minmax(0,1fr),380px] gap-16 pb-16">

            {/* ── Left column ── */}
            <div>

              {/* Photos — first thing visible after the map hero */}
              <section>
                {images.length === 1 ? (
                  <div className="overflow-hidden rounded-xl bg-slate-100" style={{ aspectRatio: "16 / 7" }}>
                    <img
                      src={images[0]}
                      alt={listing.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {images.slice(0, 4).map((img, i) => (
                      <div
                        key={i}
                        className="relative overflow-hidden rounded-xl bg-slate-100"
                        style={{ aspectRatio: "4 / 3" }}
                      >
                        <img
                          src={img}
                          alt={`${listing.title} photo ${i + 1}`}
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                        />
                        {i === 3 && images.length > 4 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40">
                            <span className="text-[14px] font-semibold text-white">+{images.length - 4} more</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Facts grid */}
              <section>
                <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-slate-200">
                  {([
                    { label: "Verified bookings", value: "106,000+", sub: "across carpark",   green: false },
                    { label: "Average rating",     value: "4.6",      sub: "12,400 reviews",  green: true  },
                    { label: "Confirmation",       value: "Instant",  sub: "no waitlist",     green: false },
                    { label: "Cancellation",       value: "Free",     sub: "up to 1 hr before", green: false },
                  ] as const).map(({ label, value, sub, green }, i) => (
                    <div
                      key={label}
                      className={`flex flex-col gap-1 px-5 py-4 ${i < 3 ? "border-r border-slate-200" : ""}`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                        {label}
                      </p>
                      <p className={`text-[17px] font-bold leading-tight ${green ? "text-brand-500" : "text-slate-950"}`}>
                        {value}
                      </p>
                      <p className="text-[12px] text-slate-400">{sub}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* About */}
              <section className="mt-10 border-t border-slate-100 pt-10">
                <h2 className="text-[22px] font-bold tracking-[-0.02em] text-slate-950">
                  About this spot
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">{listing.availability}</p>
                <p className="mt-4 text-[13px] text-slate-400">
                  Full address confirmed once your booking is complete.
                </p>
              </section>

              {/* Amenities */}
              {listing.amenities && listing.amenities.length > 0 && (
                <section className="mt-10 border-t border-slate-100 pt-10">
                  <h2 className="text-[22px] font-bold tracking-[-0.02em] text-slate-950">
                    What&apos;s included
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-400">
                    Everything you get with this booking.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4">
                    {listing.amenities.map((amenity) => {
                      const Icon = amenityToIcon(amenity);
                      return (
                        <div key={amenity} className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                            <Icon className="h-[18px] w-[18px] text-slate-600" />
                          </div>
                          <span className="text-[15px] text-slate-800">{amenity}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Reviews */}
              <section className="mt-10 border-t border-slate-100 pt-10">
                <div className="mb-6 flex items-baseline gap-4">
                  <span className="text-[40px] font-bold leading-none tracking-[-0.02em] text-slate-950">
                    {rating.toFixed(1)}
                  </span>
                  <div>
                    <div className="flex items-center gap-1">
                      <StarRow rating={rating} />
                    </div>
                    <p className="mt-0.5 text-[13px] text-slate-400">
                      From {ratingCount} verified bookings
                    </p>
                  </div>
                </div>

                {reviews.length === 0 ? (
                  <p className="text-[14px] text-slate-400">No reviews yet.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-8">
                      {reviews.slice(0, 4).map((review: any) => (
                        <div key={review.id}>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[13px] font-bold text-slate-600">
                              {String(review.id ?? "?").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-[12px] text-slate-400">
                              {formatReviewDate(review.createdAt ?? review.created_at)}
                            </span>
                          </div>
                          <StarRow rating={Number(review.rating)} />
                          {review.comment && (
                            <p className="mt-2 text-[14px] leading-6 text-slate-600">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {reviews.length > 4 && (
                      <button
                        type="button"
                        className="mt-7 flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        See all {reviews.length} reviews →
                      </button>
                    )}
                  </>
                )}
              </section>

              {/* Policies */}
              <section className="mt-10 border-t border-slate-100 pt-10">
                <h2 className="text-[22px] font-bold tracking-[-0.02em] text-slate-950">
                  Things to know
                </h2>
                <div className="mt-5 grid grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-[15px] font-semibold text-slate-950">Cancellation</h4>
                    <p className="mt-1.5 text-[13px] leading-6 text-slate-500">
                      Free up to 1 hour before your booking starts. After that, the first hour is non-refundable.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold text-slate-950">Access</h4>
                    <p className="mt-1.5 text-[13px] leading-6 text-slate-500">
                      Full access details are shared once your booking is confirmed — no host meet-up needed.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold text-slate-950">Booking</h4>
                    <p className="mt-1.5 text-[13px] leading-6 text-slate-500">
                      Confirmation is immediate. You won&apos;t be charged until you complete your reservation.
                    </p>
                  </div>
                </div>
              </section>

            </div>

            {/* ── Right rail ── */}
            <aside>
              <div className="sticky top-[80px]">
                {resolvedSearchParams.created && (
                  <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                    Listing published successfully.
                  </div>
                )}
                <div className="rounded-2xl border border-slate-200 p-6 shadow-[0_4px_24px_rgba(15,23,42,0.08)]">
                  <SidebarBookingCard
                    listingId={listing.id}
                    pricePerDay={listing.pricePerDay}
                    pricePerHour={listing.pricePerHour}
                    rateType={listing.rateType}
                    unitPrice={unitPrice}
                    rateLabel={rateLabel}
                  />
                </div>
              </div>
            </aside>

          </div>
        </div>
      </div>
    </div>
  );
}
