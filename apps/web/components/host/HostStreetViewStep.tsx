"use client";

import { useEffect, useRef } from "react";
import type { HostStepProps } from "./types";

type StreetViewPov = {
  heading: number;
  pitch: number;
};

type StreetViewPanoramaLike = {
  getPov(): StreetViewPov;
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
  google?: {
    maps?: {
      StreetViewPanorama?: StreetViewPanoramaCtor;
    };
  };
};

export function HostStreetViewStep({ data, onUpdate }: HostStepProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<StreetViewPanoramaLike | null>(null);
  const hasCoords = typeof data.latitude === "number" && typeof data.longitude === "number";

  useEffect(() => {
    if (!hasCoords || !viewerRef.current) return;
    const latitude = data.latitude;
    const longitude = data.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") return;

    const init = () => {
      const g = (window as GoogleWindow).google;
      if (!g?.maps?.StreetViewPanorama || !viewerRef.current) return;
      if (panoRef.current) return;

      panoRef.current = new g.maps.StreetViewPanorama(viewerRef.current, {
        position: { lat: latitude, lng: longitude },
        pov: { heading: data.coverHeading ?? 0, pitch: data.coverPitch ?? 0 },
        zoom: 0,
        fullscreenControl: false,
        addressControl: false,
        showRoadLabels: false,
        motionTracking: false,
        motionTrackingControl: false,
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

  const handleUseView = () => {
    const g = (window as GoogleWindow).google;
    if (panoRef.current && g?.maps) {
      const pov = panoRef.current.getPov();
      onUpdate({ coverHeading: Math.round(pov.heading), coverPitch: Math.round(pov.pitch) });
    }
  };

  const handleSkip = () => {
    onUpdate({ coverHeading: null });
  };

  if (!hasCoords) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
        <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        <p className="text-sm font-semibold text-slate-700">No location set</p>
        <p className="text-xs text-slate-500">Go back and confirm your address first</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Look around to find the angle that best shows your parking spot entrance. This angle will be used as the listing cover.
      </p>

      {/* Street View viewer */}
      <div
        ref={viewerRef}
        className="h-80 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
      />

      {/* Saved confirmation */}
      {data.coverHeading != null && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
          </svg>
          View saved — heading {data.coverHeading}°
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleUseView}
          className="flex-1 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          Use this view
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
