"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MapPin, Star } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import { getFavourites, removeFavourite, type FavouriteListing } from "../../../lib/api";

export default function FavouritesPage() {
  const { user, token, loading } = useAuth();
  const [favourites, setFavourites] = useState<FavouriteListing[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!token) return;
    setStatus("loading"); setError(null);
    try {
      const data = await getFavourites(token);
      setFavourites(data);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load favourites");
      setStatus("error");
    }
  };

  useEffect(() => { if (token) void load(); }, [token]);

  const handleRemove = async (id: string) => {
    if (!token || removing.has(id)) return;
    setRemoving((prev) => new Set(prev).add(id));
    try {
      await removeFavourite(id, token);
      setFavourites((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove favourite.");
    } finally {
      setRemoving((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>;

  if (!user) return (
    <div className="px-5 py-10">
      <p className="text-[14px] text-slate-600">Sign in to view your saved spaces.</p>
      <div className="mt-4 flex flex-col gap-3">
        <Link href="/login" className="flex h-12 items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white">Sign in</Link>
        <Link href="/signup" className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 text-[15px] font-semibold text-slate-700">Create account</Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 px-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Saved spaces</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Favourites</h1>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}

      <div>
        {status === "loading" && favourites.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        )}

        {status === "idle" && favourites.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-12 text-center">
            <Heart className="mb-3 h-8 w-8 text-slate-300" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-slate-700">No favourites yet</p>
            <p className="mt-1 text-[13px] text-slate-400">Tap the heart on any listing to save it here.</p>
            <Link href="/" className="mt-5 inline-flex items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-[13px] font-semibold text-white">
              Browse spaces
            </Link>
          </div>
        )}

        {favourites.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favourites.map((listing) => (
              <FavouriteCard key={listing.id} listing={listing} removing={removing.has(listing.id)} onRemove={() => handleRemove(listing.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FavouriteCard({ listing, removing, onRemove }: { listing: FavouriteListing; removing: boolean; onRemove: () => void }) {
  const image = listing.imageUrls?.[0];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="relative h-36 bg-slate-100">
        {image ? (
          <img src={image} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <MapPin className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
          </div>
        )}
        <button type="button" onClick={onRemove} disabled={removing}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow-sm disabled:opacity-50">
          <Heart className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <div className="p-4">
        <p className="line-clamp-1 text-[14px] font-bold text-slate-900">{listing.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-400">
          <MapPin className="h-3 w-3 text-brand-500" strokeWidth={2} />
          <span className="line-clamp-1">{listing.address}</span>
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-0.5 text-[12px] font-semibold text-slate-600">
            <Star className="h-3.5 w-3.5 text-amber-400" strokeWidth={2} />
            {listing.rating ? listing.rating.toFixed(1) : "New"}
          </span>
        </div>
        <Link href={`/listing/${listing.id}` as any}
          className="mt-3 flex h-10 items-center justify-center rounded-xl bg-brand-500 text-[13px] font-semibold text-white active:bg-brand-600">
          View &amp; book
        </Link>
      </div>
    </div>
  );
}
