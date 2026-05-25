"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Listing } from "./ListingCard";

type BoundsLiteral = { north: number; south: number; east: number; west: number };

type MapViewProps = {
  listings: Listing[];
  center?: { lat: number; lng: number };
  initialZoom?: number;
  maxZoom?: number;
  minFitZoom?: number;
  controlsPosition?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  controlsOffset?: { top?: number; right?: number; bottom?: number; left?: number };
  selectedListingId?: string;
  onSelectListing?: (listingId: string) => void;
  onMarkerClick?: (listing: Listing) => void;
  onBoundsChanged?: (bounds: BoundsLiteral, center: { lat: number; lng: number }, zoom: number, userInteracted: boolean) => void;
  disableAutoFit?: boolean;
  showCenterPin?: boolean;
};

function buildMarkerSvg(price: number, active: boolean): string {
  const priceText = `€${price}`;
  const textLength = priceText.length;
  const width = Math.max(44, 44 + Math.max(0, (textLength - 3) * 6));
  const bubbleHeight = 24;
  const tailHeight = 5;
  const tailWidth = 8;
  const strokeWidth = 1.35;
  const radius = bubbleHeight / 2;
  const padding = strokeWidth;
  const totalHeight = bubbleHeight + tailHeight;
  const viewBoxWidth = width + padding * 2;
  const viewBoxHeight = totalHeight + padding * 2;
  const shadowCx = viewBoxWidth / 2;
  const shadowCy = viewBoxHeight - 2;
  const fill = active ? "#111111" : "#FFFFFF";
  const stroke = active ? "#111111" : "#1E293B";
  const textColor = active ? "#FFFFFF" : "#0F172A";
  const w = width;
  const h = bubbleHeight;
  const r = radius;
  const tw = tailWidth / 2;
  const th = tailHeight;
  const cx = w / 2;
  const p = padding;
  const pinPath = `
    M ${r + p} ${p}
    L ${w - r + p} ${p}
    A ${r} ${r} 0 0 1 ${w + p} ${r + p}
    A ${r} ${r} 0 0 1 ${w - r + p} ${h + p}
    L ${cx + tw + p} ${h + p}
    L ${cx + p} ${h + th + p}
    L ${cx - tw + p} ${h + p}
    L ${r + p} ${h + p}
    A ${r} ${r} 0 0 1 ${p} ${r + p}
    A ${r} ${r} 0 0 1 ${r + p} ${p}
    Z
  `.trim();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewBoxWidth}" height="${viewBoxHeight}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" fill="none">
    <ellipse cx="${shadowCx}" cy="${shadowCy}" rx="${Math.max(7, width * 0.16)}" ry="2.3" fill="rgba(15,23,42,0.12)"/>
    <path d="${pinPath}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    <text x="${viewBoxWidth / 2}" y="${bubbleHeight / 2 + padding + 4}" text-anchor="middle" fill="${textColor}" font-size="12" font-family="Inter,Arial,sans-serif" font-weight="700" letter-spacing="-0.15">${priceText}</text>
  </svg>`;
}

function createMarkerEl(price: number, active: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cursor = "pointer";
  el.innerHTML = buildMarkerSvg(price, active);
  return el;
}

function createCenterPinEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32" fill="none">
    <path d="M12 0C5.373 0 0 5.13 0 11.455 0 20.545 12 32 12 32s12-11.455 12-20.545C24 5.13 18.627 0 12 0Z" fill="#2563EB"/>
    <circle cx="12" cy="11" r="4.5" fill="white"/>
  </svg>`;
  return el;
}

const clampZoom = (value: number, min?: number, max?: number) => {
  let z = value;
  if (typeof min === "number") z = Math.max(z, min);
  if (typeof max === "number") z = Math.min(z, max);
  return z;
};

export function MapView({
  listings,
  center,
  initialZoom = 12,
  maxZoom = 12,
  minFitZoom,
  controlsPosition = "top-right",
  controlsOffset,
  selectedListingId,
  onSelectListing,
  onMarkerClick,
  onBoundsChanged,
  disableAutoFit = false,
  showCenterPin = false,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement; listing: Listing }>>(new Map());
  const centerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const markerSignatureRef = useRef<string>("");
  const [mapReady, setMapReady] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);
  const hasUserDraggedRef = useRef(false);
  const prevSelectedRef = useRef<string | null>(null);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token.trim().length === 0) {
      setTokenMissing(true);
      return;
    }
    setTokenMissing(false);
    mapboxgl.accessToken = token;
    const defaultCenter = center ?? { lat: 53.3498, lng: -6.2603 };
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [defaultCenter.lng, defaultCenter.lat],
      zoom: initialZoom,
    });
    map.on("load", () => setMapReady(true));
    map.on("dragstart", () => { hasUserDraggedRef.current = true; });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), controlsPosition);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bounds-change callback
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !onBoundsChanged) return;
    const handleIdle = () => {
      const b = map.getBounds()!;
      const c = map.getCenter();
      const interacted = hasUserDraggedRef.current;
      hasUserDraggedRef.current = false;
      onBoundsChanged(
        { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
        { lat: c.lat, lng: c.lng },
        map.getZoom(),
        interacted,
      );
    };
    map.on("idle", handleIdle);
    return () => { map.off("idle", handleIdle); };
  }, [mapReady, onBoundsChanged]);

  // Markers + auto-fit
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const signature = listings
      .filter((l) => typeof l.latitude === "number" && typeof l.longitude === "number")
      .map((l) => `${l.id}-${l.latitude}-${l.longitude}-${l.pricePerDay}`)
      .join("|");

    if (signature === markerSignatureRef.current) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();
    markerSignatureRef.current = signature;

    listings.forEach((listing) => {
      if (typeof listing.latitude !== "number" || typeof listing.longitude !== "number") return;
      const active = selectedListingId === listing.id;
      const el = createMarkerEl(listing.pricePerDay, active);
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([listing.longitude, listing.latitude])
        .addTo(map);
      el.addEventListener("click", () => {
        onSelectListing?.(listing.id);
        onMarkerClick?.(listing);
      });
      markersRef.current.set(listing.id, { marker, el, listing });
    });

    if (showCenterPin && center) {
      if (!disableAutoFit) {
        map.flyTo({ center: [center.lng, center.lat], zoom: clampZoom(initialZoom, minFitZoom, maxZoom) });
      }
      return;
    }

    if (disableAutoFit) return;

    const entries = Array.from(markersRef.current.values());
    if (entries.length === 1) {
      const { listing } = entries[0];
      map.flyTo({ center: [listing.longitude!, listing.latitude!], zoom: clampZoom(initialZoom, minFitZoom, maxZoom) });
    } else if (entries.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      entries.forEach(({ listing }) => bounds.extend([listing.longitude!, listing.latitude!]));
      map.fitBounds(bounds, { padding: 60, maxZoom, duration: 300 });
      if (typeof minFitZoom === "number") {
        map.once("moveend", () => {
          if (map.getZoom() < minFitZoom) map.setZoom(minFitZoom);
        });
      }
    } else if (center) {
      map.flyTo({ center: [center.lng, center.lat], zoom: clampZoom(initialZoom, minFitZoom, maxZoom) });
    }
  }, [listings, center, selectedListingId, mapReady, initialZoom, maxZoom, minFitZoom, onMarkerClick, onSelectListing, disableAutoFit, showCenterPin]);

  // Active marker style
  useEffect(() => {
    if (!mapReady) return;
    if (prevSelectedRef.current && markersRef.current.has(prevSelectedRef.current)) {
      const { el, listing } = markersRef.current.get(prevSelectedRef.current)!;
      el.innerHTML = buildMarkerSvg(listing.pricePerDay, false);
    }
    if (selectedListingId && markersRef.current.has(selectedListingId)) {
      const { el, listing } = markersRef.current.get(selectedListingId)!;
      el.innerHTML = buildMarkerSvg(listing.pricePerDay, true);
    }
    prevSelectedRef.current = selectedListingId ?? null;
  }, [selectedListingId, mapReady]);

  // Center pin
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (!center || !showCenterPin) {
      centerMarkerRef.current?.remove();
      centerMarkerRef.current = null;
      return;
    }
    if (!centerMarkerRef.current) {
      centerMarkerRef.current = new mapboxgl.Marker({ element: createCenterPinEl(), anchor: "bottom" })
        .setLngLat([center.lng, center.lat])
        .addTo(map);
    } else {
      centerMarkerRef.current.setLngLat([center.lng, center.lat]);
    }
  }, [center, showCenterPin, mapReady]);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-xl bg-slate-100"
      style={{
        ["--map-controls-top" as any]: controlsOffset?.top !== undefined ? `${controlsOffset.top}px` : undefined,
        ["--map-controls-right" as any]: controlsOffset?.right !== undefined ? `${controlsOffset.right}px` : undefined,
        ["--map-controls-bottom" as any]: controlsOffset?.bottom !== undefined ? `${controlsOffset.bottom}px` : undefined,
        ["--map-controls-left" as any]: controlsOffset?.left !== undefined ? `${controlsOffset.left}px` : undefined,
      }}
    >
      <div ref={containerRef} className="h-full w-full" />
      {tokenMissing && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 text-center text-sm text-slate-600">
          <div className="max-w-xs rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Mapbox token missing</p>
            <p className="mt-2 text-xs text-slate-500">
              Set <code className="rounded bg-slate-100 px-1 py-0.5">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the map.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
