"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../components/AuthProvider";
import { getFavourites, removeFavourite, type FavouriteListing } from "../../../lib/api";
import { StarIcon, MapPinIcon, HeartIcon } from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutlineIcon } from "@heroicons/react/24/outline";

export default function FavouritesPage() {
  const { user, token, loading } = useAuth();
  const [favourites, setFavourites] = useState<FavouriteListing[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!token) return;
    setStatus("loading");
    setError(null);
    try {
      const data = await getFavourites(token);
      setFavourites(data);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load favourites");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (token) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRemove = async (id: string) => {
    if (!token || removing.has(id)) return;
    setRemoving((prev) => new Set(prev).add(id));
    try {
      await removeFavourite(id, token);
      setFavourites((prev) => prev.filter((f) => f.id !== id));
    } catch {
      // silently ignore
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (loading) return <div className="text-sm text-slate-600">Loading…</div>;

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Sign in to view your saved spaces.</p>
        <div className="flex gap-2 text-sm">
          <Link href="/login" className="btn-primary">Sign in</Link>
          <Link href="/signup" className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3 rounded-lg border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white shadow-lg">
        <div className="text-xs font-semibold tracking-[0.28em] text-emerald-200">Saved spaces</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl tracking-tight font-semibold leading-tight sm:text-4xl">
              <HeartIcon className="mr-2 inline h-7 w-7 text-rose-400" />
              Your favourites
            </h1>
            <p className="mt-1 text-sm text-emerald-100/85">
              Spaces you&apos;ve saved for quick access.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
          >
            Find more spaces
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {status === "loading" && (
        <div className="text-sm text-slate-600">Loading favourites…</div>
      )}

      {status === "idle" && favourites.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <HeartOutlineIcon className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <p className="text-base font-semibold text-slate-900">No favourites yet</p>
          <p className="mt-1 text-sm text-slate-600">
            Tap the heart icon on any listing to save it here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Browse spaces
          </Link>
        </div>
      )}

      {favourites.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favourites.map((listing) => (
            <FavouriteCard
              key={listing.id}
              listing={listing}
              removing={removing.has(listing.id)}
              onRemove={() => handleRemove(listing.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FavouriteCard({
  listing,
  removing,
  onRemove,
}: {
  listing: FavouriteListing;
  removing: boolean;
  onRemove: () => void;
}) {
  const image = listing.imageUrls?.[0];

  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Image */}
      <div className="relative h-36 bg-slate-100">
        {image ? (
          <img src={image} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <MapPinIcon className="h-10 w-10 text-slate-300" />
          </div>
        )}
        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          title="Remove from favourites"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow-sm transition hover:bg-white hover:text-rose-700 disabled:opacity-50"
        >
          <HeartIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">{listing.title}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          <MapPinIcon className="h-3 w-3 text-emerald-500" />
          <span className="line-clamp-1">{listing.address}</span>
        </p>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-600">
            <StarIcon className="h-3.5 w-3.5 text-amber-400" />
            {listing.rating ? listing.rating.toFixed(1) : "New"}
            {listing.ratingCount ? (
              <span className="font-normal text-slate-500">({listing.ratingCount})</span>
            ) : null}
          </div>
          {listing.pricePerDay && (
            <span className="text-sm font-bold text-emerald-600">
              €{listing.pricePerDay}
              <span className="text-xs font-normal text-slate-500">/day</span>
            </span>
          )}
        </div>

        <Link
          href={`/listing/${listing.id}`}
          className="mt-3 block w-full rounded-lg bg-emerald-600 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          View &amp; book
        </Link>
      </div>
    </div>
  );
}
