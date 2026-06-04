"use client";
import { MapPin } from "lucide-react";

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

export function HostStreetViewStep({ data, onUpdate, onSkip }: HostStepProps & { onSkip?: () => void }) {
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
      onSkip?.();
    }
  };

  const handleSkip = () => {
    onUpdate({ coverHeading: null });
    onSkip?.();
  };

  if (!hasCoords) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
        <MapPin className="h-8 w-8 text-slate-300" strokeWidth={1.4} />
        <p className="text-sm font-semibold text-slate-700">No location set</p>
        <p className="text-xs text-slate-600">Go back and confirm your address first</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-slate-600">
          Can&apos;t see your space from here? You can add your own photos at a later step.
        </p>
        <button
          type="button"
          onClick={handleSkip}
          className="mt-1.5 text-[13px] font-semibold text-brand-500 hover:text-brand-600"
        >
          Skip for now →
        </button>
      </div>

      {/* Street View viewer */}
      <div
        ref={viewerRef}
        className="h-80 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
      />

      {/* Actions */}
      <button
        type="button"
        onClick={handleUseView}
        className="w-full rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-white transition hover:bg-brand-600"
      >
        Use this view
      </button>
    </div>
  );
}
