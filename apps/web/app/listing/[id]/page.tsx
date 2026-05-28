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
import { ListingViewTracker } from "./ListingViewTracker";

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
      <ListingViewTracker listingId={listing.id} title={listing.title} />
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

            {/* Secure booking badge */}
            <div className="shrink-0 rounded-lg border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4 text-brand-500" />
                <span className="text-[13px] font-semibold text-slate-950">Secure booking</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Payments encrypted &amp; protected</p>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="bg-brand-500">
          <div className="mx-auto max-w-6xl px-6 py-2.5">
            <div className="flex items-center justify-between text-[12.5px] font-semibold text-white">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>Secure, encrypted payment</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Instant booking confirmation</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>No hidden fees</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Cancel before your booking starts</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Hero map — full-bleed cover photo ── */}
        <div className="relative h-[420px] w-full overflow-hidden">
          {hasCoords ? (
            <ListingMap
              listing={listingForMap}
              center={{ lat: listing.latitude!, lng: listing.longitude! }}
              zoom={14}
              interactive={false}
            />
          ) : (
            <img src={images[0]} alt={listing.title} className="h-full w-full object-cover" />
          )}

          {/* Dark gradient scrim so white text is always legible over the map */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Address + directions overlay — sits above the photo card overlap */}
          <div className="absolute bottom-20 left-0 right-0">
            <div className="mx-auto max-w-6xl px-6">
              <div className="flex items-end justify-between">
                <div style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.8)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white">
                    Parking space
                  </p>
                  <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-[-0.02em] text-white">
                    {listing.address.split(",")[0]}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white">
                    <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                    {listing.address.split(",").slice(1, 3).join(",").trim()}
                  </p>
                </div>
                {streetViewHref && (
                  <a
                    href={streetViewHref}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-2 text-[12px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
                  >
                    <MapPinIcon className="h-3.5 w-3.5" />
                    Street view
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main grid: left (content) | right (booking card hovers over map) */}
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-[minmax(0,1fr),320px] gap-0">

            {/* ── Left column ── */}
            <div className="border-r border-slate-100 pr-8">

              {/* Photo gallery — white-framed card floating 60 px into the map */}
              {images.length > 0 && (
                <div
                  className="relative z-10 rounded-t-xl bg-white px-2 pt-2 shadow-[0_-6px_32px_rgba(15,23,42,0.18)]"
                  style={{ marginTop: "-60px" }}
                >
                  {images.length === 1 ? (
                    /* Single image */
                    <div className="overflow-hidden rounded-lg bg-slate-100">
                      <div className="aspect-[16/7]">
                        <img
                          src={images[0]}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Multi-image mosaic: large left + 2 stacked right */
                    <div
                      className="overflow-hidden rounded-lg"
                      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", height: "220px" }}
                    >
                      {/* Large hero image */}
                      <div className="overflow-hidden bg-slate-100">
                        <img
                          src={images[0]}
                          alt={listing.title}
                          className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                        />
                      </div>

                      {/* Right column: 2 stacked */}
                      <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: "2px" }}>
                        {([images[1], images[2] ?? images[1]] as string[]).map((img, i) => (
                          <div key={i} className="relative overflow-hidden bg-slate-100">
                            <img
                              src={img}
                              alt={`${listing.title} photo ${i + 2}`}
                              className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                            />
                            {/* "+N more" overlay on last thumbnail */}
                            {i === 1 && images.length > 3 && (
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-[1px]">
                                <span className="text-[15px] font-semibold text-white">
                                  +{images.length - 3} more
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Photo count badge */}
                  <button
                    type="button"
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-white/30 bg-black/45 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-md transition hover:bg-black/60"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    {images.length} {images.length === 1 ? "photo" : "photos"}
                  </button>
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
                  <div className="mt-5 flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50/60 p-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100">
                      <ShieldCheckIcon className="h-4 w-4 text-brand-600" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">Important notice:</p>
                      <p className="mt-0.5 text-[13px] leading-6 text-slate-600">
                        The full address of the parking space will be provided following a successful booking.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Included features */}
                {listing.amenities && listing.amenities.length > 0 && (
                  <section className="border-t border-slate-100 py-8">
                    <h2 className="text-[26px] font-bold leading-tight tracking-[-0.03em] text-slate-950">
                      Included features
                    </h2>
                    <div className="mt-5 space-y-0">
                      {listing.amenities.map((amenity) => {
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
                {hasCoords && (
                  <section className="border-t border-slate-100 py-8">
                    <div className="h-64 overflow-hidden rounded-lg">
                      <ListingMap
                        listing={listingForMap}
                        center={{ lat: listing.latitude!, lng: listing.longitude! }}
                        zoom={14}
                      />
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

            {/* ── Right column: hovers over map, then scrolls with page ── */}
            <aside className="pl-8" style={{ marginTop: "-220px" }}>
              <div className="sticky top-[68px]">
                {resolvedSearchParams.created && (
                  <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
                    Listing published successfully.
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_8px_40px_rgba(0,0,0,0.18)]">
                  <SidebarBookingCard
                    listingId={listing.id}
                    pricePerDay={listing.pricePerDay}
                    pricePerHour={listing.pricePerHour}
                    rateType={listing.rateType}
                    unitPrice={unitPrice}
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
