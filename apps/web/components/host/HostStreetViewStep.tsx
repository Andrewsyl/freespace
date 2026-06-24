"use client";
import { MapPin } from "lucide-react";

import { useEffect, useRef } from "react";
import type { HostStepProps } from "./types";
import { SectionLabel } from "./_ui";

type StreetViewPov = { heading: number; pitch: number };

type StreetViewPanoramaLike = {
  getPov(): StreetViewPov;
  addListener(event: string, handler: () => void): { remove: () => void };
};

type StreetViewPanoramaCtor = new (
  element: HTMLElement,
  options: {
    position: { lat: number; lng: number };
    pov: StreetViewPov;
    zoom: number;
    fullscreenControl: boolean;
    addressControl: boolean;
    showRoadLabels: boolean;
    motionTracking: boolean;
    motionTrackingControl: boolean;
  }
) => StreetViewPanoramaLike;

type GoogleWindow = Window & {
  google?: { maps?: { StreetViewPanorama?: StreetViewPanoramaCtor } };
};

function splitAddress(address?: string): { line1: string; line2: string } {
  if (!address) return { line1: "", line2: "" };
  const idx = address.indexOf(",");
  if (idx === -1) return { line1: address, line2: "" };
  return { line1: address.slice(0, idx).trim(), line2: address.slice(idx + 1).trim() };
}

export function HostStreetViewStep({ data, onUpdate }: HostStepProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<StreetViewPanoramaLike | null>(null);
  const hasCoords = typeof data.latitude === "number" && typeof data.longitude === "number";
  const { line1, line2 } = splitAddress(data.address);

  useEffect(() => {
    if (!hasCoords || !viewerRef.current) return;
    const latitude = data.latitude;
    const longitude = data.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") return;

    const init = () => {
      const g = (window as GoogleWindow).google;
      if (!g?.maps?.StreetViewPanorama || !viewerRef.current || panoRef.current) return;

      const pano = new g.maps.StreetViewPanorama(viewerRef.current, {
        position: { lat: latitude, lng: longitude },
        pov: { heading: data.coverHeading ?? 0, pitch: data.coverPitch ?? 0 },
        zoom: 0,
        fullscreenControl: false,
        addressControl: false,
        showRoadLabels: false,
        motionTracking: false,
        motionTrackingControl: false,
      });
      panoRef.current = pano;

      // Persist the chosen angle continuously, so the footer "Confirm" just works.
      onUpdate({ coverHeading: data.coverHeading ?? 0, coverPitch: data.coverPitch ?? 0 });
      pano.addListener("pov_changed", () => {
        const pov = pano.getPov();
        onUpdate({ coverHeading: Math.round(pov.heading), coverPitch: Math.round(pov.pitch) });
      });
    };

    if ((window as GoogleWindow).google?.maps?.StreetViewPanorama) {
      init();
    } else {
      const timer = setInterval(() => {
        if ((window as GoogleWindow).google?.maps?.StreetViewPanorama) {
          clearInterval(timer);
          init();
        }
      }, 100);
      return () => clearInterval(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasCoords) {
    return (
      <div>
        <SectionLabel>Street view</SectionLabel>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <MapPin className="h-8 w-8 text-slate-300" strokeWidth={1.4} />
          <div>
            <p className="text-[14px] font-semibold text-slate-700">No location set</p>
            <p className="mt-0.5 text-[13px] text-slate-500">Go back and confirm your address first.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Read-only address summary */}
      <div className="max-w-[760px] rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-[15px] font-semibold text-slate-900">{line1 || data.address}</p>
        {line2 && <p className="mt-0.5 text-[14px] text-slate-500">{line2}</p>}
      </div>

      {/* Street view — mirrors the map screen's framing */}
      <div>
        <SectionLabel>Choose your photo angle</SectionLabel>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div ref={viewerRef} className="h-[360px] w-full" />
        </div>
        <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-slate-500">
          Drag to find the angle that best shows your parking entrance, then confirm below. We only share the
          exact location once a driver has a confirmed booking.
        </p>
      </div>
    </div>
  );
}
