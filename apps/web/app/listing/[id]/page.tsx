import { notFound } from "next/navigation";
import { StarIcon, MapPinIcon } from "@heroicons/react/24/solid";
import { getListing, listListingReviews } from "../../../lib/api";
import { formatListingPriceLine } from "../../../lib/pricing";
import type { Listing } from "../../../components/ListingCard";
import { ListingMap } from "./MapSection";
import { WalkTime } from "./WalkTime";
import { BookingSelector } from "./BookingSelector";
import { SlimNav } from "../../../components/SlimNav";
import { MobileListingView } from "./MobileListingView";

function fallbackImage(title: string) {
  const encoded = encodeURIComponent(title);
  return `https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1600&q=80&sat=-15&title=${encoded}`;
}

function formatAreaLabel(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return address;
  const first = parts[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
  return [first || parts[0], ...parts.slice(1)].join(", ");
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
  const areaLabel = formatAreaLabel(listing.address);

  return (
    <div className="min-h-screen bg-[#f5f7fb] lg:bg-slate-50">
      <SlimNav />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {resolvedSearchParams.created && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Listing published successfully.
          </div>
        )}

        {/* Mobile layout */}
        <MobileListingView
          listing={listing}
          listingForMap={listingForMap}
          areaLabel={areaLabel}
          reviews={reviews as any}
          fallbackImage={fallback}
        />

        

        {/* Desktop layout */}
        <div className="hidden lg:block">
          <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="grid lg:grid-cols-[1.15fr,0.85fr]">
              <div className="p-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Parking space</p>
                <h1 className="mt-4 max-w-3xl text-[48px] font-semibold leading-[1.02] tracking-[-0.055em] text-slate-950">
                  {listing.title}
                </h1>
                <p className="mt-4 flex items-center gap-2 text-[15px] text-slate-500">
                  <MapPinIcon className="h-4 w-4 text-brand-500" />
                  {areaLabel}
                </p>

                <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50">
                  {[
                    { label: "Price", value: formatListingPriceLine(listing) },
                    { label: "Availability", value: listing.availability },
                    { label: "Rating", value: listing.rating?.toFixed(1) ?? "5.0" },
                    { label: "Reviews", value: String(listing.ratingCount ?? 0) },
                  ].map((item, index) => (
                    <div
                      key={item.label}
                      className={`flex items-center justify-between px-5 py-4 ${index !== 0 ? "border-t border-slate-200" : ""}`}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {item.label}
                      </span>
                      <span className="text-[15px] font-semibold text-slate-950">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-l border-slate-200 bg-slate-100">
                <div className="relative h-full min-h-[420px]">
                  <img src={images[0]} alt={listing.title} className="h-full w-full object-cover" />
                  <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm">
                    <StarIcon className="h-4 w-4 text-amber-500" />
                    {listing.rating?.toFixed(1) ?? "5.0"} ({listing.ratingCount ?? 0})
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">
              <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-slate-950">About this space</h2>
                <p className="mt-4 max-w-3xl text-[16px] leading-8 text-slate-600">
                  {listing.availability}
                </p>
                {listing.accessCode && (
                  <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                    Access details are shared after booking confirmation.
                  </div>
                )}
              </section>

              {listing.amenities && listing.amenities.length > 0 && (
                <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
                  <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-slate-950">Included features</h2>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {listing.amenities.map((amenity) => (
                      <span key={amenity} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {listing.latitude != null && listing.longitude != null && (
                <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
                  <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-slate-950">The local area</h2>
                  <div className="mt-5 h-72 overflow-hidden rounded-[24px] border border-slate-200">
                    <ListingMap
                      listing={listingForMap}
                      center={{ lat: listing.latitude, lng: listing.longitude }}
                      zoom={14}
                    />
                  </div>
                  <div className="mt-5">
                    <WalkTime origin={{ lat: listing.latitude, lng: listing.longitude }} />
                  </div>
                </section>
              )}

              <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-slate-950">Reviews</h2>
                  <span className="text-sm font-semibold text-brand-500">{reviews.length} total</span>
                </div>
                {reviews.length === 0 ? (
                  <p className="mt-4 text-[16px] text-slate-600">No reviews yet.</p>
                ) : (
                  <div className="mt-5 space-y-4">
                    {reviews.slice(0, 6).map((review: any) => (
                      <div key={review.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <StarIcon className="h-4 w-4 text-amber-500" />
                            {Number(review.rating).toFixed(1)}
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatReviewDate(review.createdAt ?? review.created_at)}
                          </span>
                        </div>
                        {review.comment && <p className="mt-3 text-[15px] leading-7 text-slate-600">{review.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <div className="sticky top-6 space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Book this space</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Choose your time</h2>
                </div>
                <BookingSelector
                  listingId={listing.id}
                  pricePerDay={listing.pricePerDay}
                  pricePerHour={listing.pricePerHour}
                  rateType={listing.rateType}
                />
                {!listing.hostStripeAccountId && (
                  <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Host payouts are not set up yet. You can still proceed for demo, but live payments require host onboarding.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
