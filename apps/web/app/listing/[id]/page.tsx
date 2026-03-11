import { notFound } from "next/navigation";
import Link from "next/link";
import { getListing } from "../../../lib/api";
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
  params: { id: string };
  searchParams: { created?: string };
}) {
  const { id } = params;
  const listing = await getListing(id).catch(() => null);
  if (!listing) notFound();

  const listingForMap: Listing = {
    ...listing,
    distanceKm: 0,
    availability: listing.availability,
    pricePerDay: listing.pricePerDay,
    rating: listing.rating ?? 5,
  };

  const image =
    listing.imageUrls?.[0] ??
    (listing.latitude != null &&
    listing.longitude != null &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? `https://maps.googleapis.com/maps/api/streetview?size=1200x800&location=${listing.latitude},${listing.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      : undefined);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-2 text-center">
        <img src="/freespace-logo.png" alt="FreeSpace" className="mx-auto h-16 w-auto mix-blend-multiply" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Listing</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{listing.title}</h1>
        <p className="text-sm text-slate-600">{listing.address}</p>
      </header>

      {searchParams.created && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Listing published successfully.
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Price</div>
          <div className="text-2xl font-semibold text-slate-900">€{listing.pricePerDay}</div>
          <div className="text-xs text-slate-500">per day</div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">Choose your time</p>
          <BookingSelector listingId={listing.id} pricePerDay={listing.pricePerDay} />
          {!listing.hostStripeAccountId && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Host payouts are not set up yet. You can still proceed for demo, but live payments require host onboarding.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-800">Details</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Availability: {listing.availability}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{listing.rating ?? 5}★ rated</span>
          </div>
          {listing.amenities && listing.amenities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {listing.amenities.map((amenity) => (
                <span key={amenity} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {amenity}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
