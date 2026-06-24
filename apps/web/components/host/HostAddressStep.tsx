"use client";
import { MapPin, Check } from "lucide-react";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AddressAutocomplete } from "../AddressAutocomplete";
import { SectionLabel } from "./_ui";
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
    onUpdate({ latitude: lat, longitude: lng, locationConfirmed: true });
    setMovePinMode(false);
  };

  return (
    <div className="space-y-10">
      {/* Address search */}
      <div>
        <SectionLabel>Address</SectionLabel>
        <div className="mt-4 max-w-[760px]">
          <AddressAutocomplete
            key={`addr-${addressVersion}`}
            defaultValue={data.address}
            placeholder="Start typing your address…"
            showLocationButton
            onPlace={(place) => {
              onUpdate({ address: place.address, latitude: place.lat, longitude: place.lng, locationConfirmed: true });
              setMovePinMode(true);
              setAddressVersion((v) => v + 1);
            }}
            name="address"
          />
        </div>
        <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-slate-500">
          We only ever show drivers the approximate area until a booking is confirmed.
        </p>
      </div>

      {/* Satellite map */}
      <div>
        <SectionLabel>Pin your exact spot</SectionLabel>
        <div
          className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
          style={{ height: 360 }}
        >
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

              {movePinMode && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ paddingBottom: 32 }}>
                  <svg width="30" height="40" viewBox="0 0 24 32" fill="none" className="drop-shadow-lg">
                    <path d="M12 0C5.373 0 0 5.13 0 11.455 0 20.545 12 32 12 32s12-11.455 12-20.545C24 5.13 18.627 0 12 0Z" fill="#0fa968"/>
                    <circle cx="12" cy="11" r="4.5" fill="white"/>
                  </svg>
                </div>
              )}

              <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
                {movePinMode ? (
                  <>
                    <div className="rounded-full bg-slate-900/80 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lg backdrop-blur-sm">
                      Drag the map to position the pin
                    </div>
                    <button
                      type="button"
                      onClick={handleDropPin}
                      className="rounded-xl bg-white px-4 py-2 text-[13px] font-bold text-slate-900 shadow-lg transition hover:bg-slate-50"
                    >
                      Drop pin here
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMovePinMode(true)}
                    className="rounded-xl bg-white px-4 py-2 text-[13px] font-bold text-slate-900 shadow-lg transition hover:bg-slate-50"
                  >
                    Move pin
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <MapPin className="h-7 w-7 text-brand-500" strokeWidth={1.6} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-slate-900">No location yet</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                  Search for your address above to preview it on the satellite map.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmed callout */}
      {data.locationConfirmed && (
        <div className="flex max-w-[760px] items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <div>
            <p className="text-[13.5px] font-semibold text-brand-800">Location confirmed</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-brand-700">
              Pin placed at your entrance. Tap “Move pin” above to adjust it any time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
