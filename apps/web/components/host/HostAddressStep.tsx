"use client";
import { MapPin } from "lucide-react";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AddressAutocomplete } from "../AddressAutocomplete";
import type { HostStepProps } from "./types";

const MapView = dynamic(() => import("../MapView").then((mod) => mod.MapView), { ssr: false });

export function HostAddressStep({ data, onUpdate }: HostStepProps) {
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [movePinMode, setMovePinMode] = useState(true);
  const [addressVersion, setAddressVersion] = useState(0);

  const hasCoords = typeof data.latitude === "number" && typeof data.longitude === "number";

  const handleDropPin = () => {
    if (!mapCenter) return;
    const { lat, lng } = mapCenter;
    onUpdate({ latitude: lat, longitude: lng, locationConfirmed: false });
    setMovePinMode(false);
  };

  return (
    <div className="space-y-4">
      {/* ── Address search ── */}
      <div className="space-y-1">
        <label className="text-sm font-semibold text-slate-800">Where is your space?</label>
        <AddressAutocomplete
          key={`addr-${addressVersion}`}
          defaultValue={data.address}
          placeholder="Search for an address"
          showLocationButton
          onPlace={(place) => {
            onUpdate({ address: place.address, latitude: place.lat, longitude: place.lng, locationConfirmed: false });
            setMovePinMode(true);
            setAddressVersion((v) => v + 1);
          }}
          name="address"
        />
        <p className="text-xs text-slate-500">Drag the satellite map to fine-tune the pin to your exact spot.</p>
      </div>

      {/* ── Satellite map ── */}
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100" style={{ height: 440 }}>
        {hasCoords ? (
          <>
            <MapView
              key={`map-${addressVersion}`}
              listings={[]}
              center={{ lat: data.latitude!, lng: data.longitude! }}
              initialZoom={19}
              maxZoom={21}
              minFitZoom={18}
              showCenterPin={!movePinMode}
              disableAutoFit={!movePinMode}
              satellite
              onBoundsChanged={(_bounds, center) => setMapCenter(center)}
            />

            {/* Crosshair pin (move mode) */}
            {movePinMode && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ paddingBottom: 32 }}>
                <svg width="28" height="38" viewBox="0 0 24 32" fill="none">
                  <path d="M12 0C5.373 0 0 5.13 0 11.455 0 20.545 12 32 12 32s12-11.455 12-20.545C24 5.13 18.627 0 12 0Z" fill="#10b981"/>
                  <circle cx="12" cy="11" r="4.5" fill="white"/>
                </svg>
              </div>
            )}

            {/* Controls */}
            <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
              {movePinMode ? (
                <>
                  <div className="rounded-full bg-brand-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow backdrop-blur-sm">
                    Drag map to position
                  </div>
                  <button
                    type="button"
                    onClick={handleDropPin}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-50"
                  >
                    Drop pin here ↓
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMovePinMode(true)}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-50"
                >
                  Move pin
                </button>
              )}
            </div>

          </>
        ) : (
          /* No address yet */
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 ring-2 ring-brand-100">
              <MapPin className="h-10 w-10 text-brand-500" strokeWidth={1.6} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">No location selected</p>
              <p className="mt-1 text-xs text-slate-500">Search for an address above to preview your parking spot on the satellite map</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirm strip ── */}
      {hasCoords && !movePinMode && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">
              {data.locationConfirmed ? "✓ Location confirmed" : "Does the pin match your entrance?"}
            </p>
            <p className="truncate text-xs text-slate-500">{data.address}</p>
          </div>
          {!data.locationConfirmed && (
            <button
              type="button"
              onClick={() => onUpdate({ locationConfirmed: true })}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Confirm location
            </button>
          )}
        </div>
      )}
    </div>
  );
}
