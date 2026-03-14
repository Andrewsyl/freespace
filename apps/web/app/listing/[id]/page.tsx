import { notFound } from "next/navigation";
import { StarIcon, MapPinIcon } from "@heroicons/react/24/solid";
import { getListing, listListingReviews } from "../../../lib/api";
import type { Listing } from "../../../components/ListingCard";
import { ListingMap } from "./MapSection";
import { WalkTime } from "./WalkTime";
import { BookingSelector } from "./BookingSelector";

function fallbackImage(title: string) {
  const encoded = encodeURIComponent(title);
  return `https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1600&q=80&sat=-15&title=${encoded}`;
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {resolvedSearchParams.created && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Listing published successfully.
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative grid gap-0 lg:grid-cols-[1.2fr,1fr]">
            <div className="relative h-72 bg-slate-200 md:h-96 lg:h-full">
              <img src={images[0]} alt={listing.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">
                <StarIcon className="h-4 w-4 text-amber-500" />
                {listing.rating?.toFixed(1) ?? "5.0"} ({listing.ratingCount ?? 0})
              </div>
            </div>
            <div className="space-y-3 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Parking space</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{listing.title}</h1>
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <MapPinIcon className="h-4 w-4 text-brand-500" />
                {listing.address}
              </p>
              <div className="flex flex-wrap gap-2 pt-2 text-xs font-semibold text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">€{listing.pricePerDay} / day</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">Availability: {listing.availability}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {listing.permissionDeclared ? "Permission verified" : "Permission pending"}
                </span>
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2 pt-4">
                  {images.slice(0, 4).map((img, idx) => (
                    <div key={`${img}-${idx}`} className="h-20 overflow-hidden rounded-xl border border-slate-200">
                      <img src={img} alt={`${listing.title} ${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">About this space</h2>
              <p className="mt-3 text-sm text-slate-600">{listing.availability}</p>
              {listing.accessCode && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  Access code is shared after booking confirmation.
                </div>
              )}
            </section>

            {listing.amenities && listing.amenities.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Features</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {listing.amenities.map((amenity) => (
                    <span key={amenity} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {amenity}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {listing.latitude != null && listing.longitude != null && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Location</h2>
                <p className="mt-2 text-sm text-slate-600">Exact location shown after booking.</p>
                <div className="mt-4 h-64 overflow-hidden rounded-xl">
                  <ListingMap
                    listing={listingForMap}
                    center={{ lat: listing.latitude, lng: listing.longitude }}
                    zoom={14}
                  />
                </div>
                <div className="mt-4">
                  <WalkTime origin={{ lat: listing.latitude, lng: listing.longitude }} />
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No reviews yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {reviews.slice(0, 6).map((review: any) => (
                    <div key={review.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          <StarIcon className="h-4 w-4 text-amber-500" />
                          {Number(review.rating).toFixed(1)}
                        </div>
                        <span className="text-xs text-slate-500">
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
            </section>
          </div>

          <aside className="space-y-4">
            <div className="sticky top-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Book this space</p>
              <BookingSelector listingId={listing.id} pricePerDay={listing.pricePerDay} />
              {!listing.hostStripeAccountId && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Host payouts are not set up yet. You can still proceed for demo, but live payments require host onboarding.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
