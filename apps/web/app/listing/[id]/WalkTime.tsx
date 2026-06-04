"use client";

import { useState } from "react";
import { MapPin, Clock } from "lucide-react";
import { AddressAutocomplete } from "../../../components/AddressAutocomplete";

async function getWalkingTime(origin: { lat: number; lng: number }, destination: { address: string; lat: number; lng: number }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Google Maps API key missing");
  const dirRes = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=walking&key=${key}`
  );
  const dirData = (await dirRes.json()) as any;
  const leg = dirData.routes?.[0]?.legs?.[0];
  if (!leg) throw new Error("Could not compute walking route");

  return {
    destinationAddress: destination.address,
    durationText: leg.duration?.text,
    distanceText: leg.distance?.text,
  };
}

export function WalkTime({ origin }: { origin: { lat: number; lng: number } }) {
  const [destination, setDestination] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<{ destinationAddress: string; durationText: string; distanceText: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) {
      setError("Choose a destination.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await getWalkingTime(origin, destination);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate walking time");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-600">Walking distance</p>
      <form onSubmit={handleCheck} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <AddressAutocomplete
            placeholder="Enter a destination (e.g. Aviva Stadium)"
            onPlace={(place) => setDestination(place)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center border border-brand-400 px-5 py-3 text-[14px] font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-50 sm:w-auto w-full"
        >
          {loading ? "Calculating…" : "Get time"}
        </button>
      </form>

      {error && (
        <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {result && (
        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[18px] font-semibold text-slate-950">{result.durationText} walk</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-slate-600">
                <MapPin className="h-4 w-4 text-brand-500" />
                {result.destinationAddress}
                <span className="text-slate-400">({result.distanceText})</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {!result && !error && (
        <p className="text-[13px] text-slate-600">
          Enter a destination to see the walking time from this space.
        </p>
      )}
    </div>
  );
}
