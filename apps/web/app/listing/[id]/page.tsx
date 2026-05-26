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
import { WalkTime } from "./WalkTime";
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
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildAvailabilityRows(availability: string) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const lower = availability.toLowerCase();
  const alwaysOpen =
    lower.includes("24 hours") ||
    lower.includes("24/7") ||
    lower.includes("monday - sunday");
  return days.map((day) => ({
    day,
    value: alwaysOpen ? "24h" : "See details",
  }));
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

// Simple star fill helper
function StarFill({ filled }: { filled: boolean }) {
  return (
    <StarIcon
      className={`h-4 w-4 ${filled ? "text-amber-400" : "text-slate-200"}`}
    />
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
  const availabilityRows = buildAvailabilityRows(listing.availability);
  const rateLabel = getListingRateType(listing) === "hourly" ? "/ hr" : "/ day";
  const unitPrice = getListingUnitPrice(listing);
  const hasCoords = listing.latitude != null && listing.longitude != null;
  const rating = listing.rating ?? 5;
  const ratingCount = listing.ratingCount ?? 0;
  const streetViewHref = hasCoords
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${listing.latitude},${listing.longitude}`
    : undefined;

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

        {/* Breadcrumb + title area */}
        <div className="mx-auto max-w-6xl px-6 pb-4 pt-5">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-slate-400">
            <a href="/search" className="transition hover:text-brand-500">Find parking</a>
            <span>›</span>
            <a href="/search" className="transition hover:text-brand-500">
              {listing.address.split(",").slice(-2).join(",").trim()}
            </a>
            <span>›</span>
            <span className="text-slate-600">{listing.title}</span>
          </nav>

          {/* Title row */}
          <div className="mt-3 flex items-start justify-between gap-8">
            <div className="min-w-0">
              <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-slate-950">
                <span className="text-brand-500">Parking at </span>
                {listing.title}
              </h1>
              <p className="mt-1 text-[14px] text-slate-500">{listing.address}</p>
              <div className="mt-2 flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <StarFill key={n} filled={n <= Math.round(rating)} />
                ))}
                <span className="text-[13px] font-semibold text-slate-800">{rating.toFixed(1)}</span>
                <span className="text-[13px] text-slate-400">· {ratingCount} bookings</span>
              </div>
            </div>

            {/* TrustScore badge */}
            <div className="shrink-0 rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">TrustScore</span>
                <span className="text-[15px] font-bold text-slate-950">4.6</span>
                <span className="text-[11px] text-slate-400">| 106,000+ reviews</span>
              </div>
              <div className="mt-1.5 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className={`h-5 w-5 rounded-[3px] ${n <= 4 ? "bg-[#00b67a]" : "bg-[#73cf11]"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="bg-brand-500">
          <div className="mx-auto max-w-6xl px-6 py-2.5">
            <div className="flex items-center justify-between text-[12.5px] font-semibold text-white">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4" />
                <span>Best price guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Confirmation is immediate</span>
              </div>
              <div className="flex items-center gap-2">
                <StarIcon className="h-4 w-4 text-white" />
                <span>4.6+ Trustpilot ratings</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Trusted by over 1 million drivers</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main grid: left (map + content) | right (sticky booking) */}
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-[minmax(0,1fr),320px] gap-0">

            {/* ── Left column ── */}
            <div className="border-r border-slate-100 pr-8">

              {/* Map */}
              <div className="relative h-[420px] overflow-hidden bg-slate-100 border-b border-slate-100">
                {hasCoords ? (
                  <ListingMap
                    listing={listingForMap}
                    center={{ lat: listing.latitude!, lng: listing.longitude! }}
                    zoom={14}
                  />
                ) : (
                  <img src={images[0]} alt={listing.title} className="h-full w-full object-cover" />
                )}
                {/* Map pin label */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm">
                  <MapPinIcon className="h-3.5 w-3.5 text-brand-500" />
                  {listing.address.split(",")[0]}
                </div>
              </div>

              {/* Photos grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-4">
                  {images.slice(0, 4).map((img, i) => (
                    <div key={`${img}-${i}`} className={`overflow-hidden bg-slate-100 ${i === 0 ? "col-span-2 aspect-[2.4/1]" : "aspect-[4/3]"}`}>
                      <img
                        src={img}
                        alt={`${listing.title} ${i + 1}`}
                        className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ── Content sections ── */}
              <div className="space-y-0 py-8">

                {/* Space overview */}
                <section className="pb-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                    {listing.title}
                  </p>
                  <h2 className="mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.03em] text-slate-950">
                    Space overview
                  </h2>
                  <p className="mt-4 text-[15px] leading-7 text-slate-600">
                    {listing.availability}
                  </p>
                  {streetViewHref && (
                    <a
                      href={streetViewHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <MapPinIcon className="h-4 w-4" />
                      Open Street View
                    </a>
                  )}
                  {/* Important notice box */}
                  <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">Important notice:</p>
                      <p className="mt-0.5 text-[13px] leading-6 text-slate-600">
                        The full address of the parking space will be provided following a successful booking.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Access hours */}
                <section className="border-t border-slate-100 py-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                    Space availability
                  </p>
                  <h2 className="mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.03em] text-slate-950">
                    Access hours
                  </h2>
                  <div className="mt-2 h-0.5 w-10 rounded-full bg-brand-500" />
                  <p className="mt-5 text-[14px] leading-7 text-slate-500">
                    This location is available to book within the access times below. Overnight parking is permitted.
                  </p>
                  <div className="mt-5 grid grid-cols-7 gap-2">
                    {availabilityRows.map((row) => (
                      <div
                        key={row.day}
                        className="flex flex-col items-center rounded-lg border border-slate-100 bg-slate-50 py-4"
                      >
                        <span className="text-[10px] font-semibold tracking-[0.06em] text-slate-400">
                          {row.day}
                        </span>
                        <span className="mt-2.5 text-[11px] font-bold text-emerald-600">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Amenities */}
                {listing.amenities && listing.amenities.length > 0 && (
                  <section className="border-t border-slate-100 py-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                      Space features
                    </p>
                    <h2 className="mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.03em] text-slate-950">
                      What&apos;s included
                    </h2>
                    {/* Tag pills row */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {listing.amenities.slice(0, 3).map((a) => (
                        <span
                          key={a}
                          className="rounded border border-slate-300 px-2.5 py-1 text-[12px] text-slate-600"
                        >
                          {a}
                        </span>
                      ))}
                      {listing.amenities.length > 3 && (
                        <span className="rounded bg-brand-500 px-2.5 py-1 text-[12px] font-semibold text-white">
                          +{listing.amenities.length - 3}
                        </span>
                      )}
                    </div>
                    {/* Full list */}
                    <div className="mt-5 grid grid-cols-2 gap-y-0">
                      {listing.amenities.map((amenity) => {
                        const Icon = amenityToIcon(amenity);
                        return (
                          <div
                            key={amenity}
                            className="flex items-center gap-3 border-b border-slate-100 py-3.5 pr-6"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                              <Icon className="h-4 w-4 text-slate-500" />
                            </div>
                            <span className="text-[14px] text-slate-700">{amenity}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Walk time */}
                {hasCoords && (
                  <section className="border-t border-slate-100 py-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                      Nearby
                    </p>
                    <h2 className="mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.03em] text-slate-950">
                      Walking distance
                    </h2>
                    <div className="mt-5">
                      <WalkTime origin={{ lat: listing.latitude!, lng: listing.longitude! }} />
                    </div>
                  </section>
                )}

                {/* Reviews */}
                <section className="border-t border-slate-100 py-8">
                  <h2 className="text-[26px] font-bold leading-tight tracking-[-0.03em] text-slate-950">
                    Reviews about this space
                  </h2>
                  {reviews.length === 0 ? (
                    <p className="mt-4 text-[14px] text-slate-400">No reviews yet.</p>
                  ) : (
                    <div className="mt-5 space-y-0">
                      {reviews.slice(0, 6).map((review: any) => (
                        <div key={review.id} className="border-b border-slate-100 py-5 last:border-b-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <StarFill key={n} filled={n <= Math.round(Number(review.rating))} />
                              ))}
                              <span className="text-[13px] font-semibold text-slate-800">
                                {Number(review.rating).toFixed(1)}
                              </span>
                            </div>
                            <span className="text-[12px] text-slate-400">
                              {formatReviewDate(review.createdAt ?? review.created_at)}
                            </span>
                          </div>
                          {review.comment && (
                            <p className="mt-3 text-[14px] leading-6 text-slate-600">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

              </div>
            </div>

            {/* ── Right column: sticky booking ── */}
            <aside className="pl-8">
              <div className="sticky top-[53px] py-6">
                {resolvedSearchParams.created && (
                  <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                    Listing published successfully.
                  </div>
                )}
                <SidebarBookingCard
                  listingId={listing.id}
                  pricePerDay={listing.pricePerDay}
                  pricePerHour={listing.pricePerHour}
                  rateType={listing.rateType}
                  unitPrice={unitPrice}
                  rateLabel={rateLabel}
                />
              </div>
            </aside>

          </div>
        </div>

      </div>
    </div>
  );
}
