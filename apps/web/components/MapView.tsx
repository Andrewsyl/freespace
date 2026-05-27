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
  /** Radius in metres for the distance ring drawn around the centre pin. */
  centerPinRadius?: number;
  satellite?: boolean;
  /** Set false to produce a static, non-interactive map (no zoom/pan/controls). */
  interactive?: boolean;
};

// ─── Price-bubble markers ────────────────────────────────────────────────────

function buildMarkerSvg(price: number, active: boolean): string {
  const priceText = `€${price}`;
  const extraChars = Math.max(0, priceText.length - 3);
  const bw = 44 + extraChars * 6;  // bubble width
  const bh = 24;                    // bubble height
  const tailH = 5;
  const tailHalfW = 4;
  const sw = 1.5;                   // stroke width
  const p = sw / 2;                 // inset so strokes aren't clipped

  const r = bh / 2;                 // bubble corner radius = 12

  const vbW = bw + p * 2;
  const vbH = bh + tailH + p + 3;

  const bx = p;
  const by = p;
  const midX = bx + bw / 2;

  const pinPath = [
    `M ${r + bx} ${by}`,
    `L ${bw - r + bx} ${by}`,
    `A ${r} ${r} 0 0 1 ${bw + bx} ${r + by}`,
    `A ${r} ${r} 0 0 1 ${bw - r + bx} ${bh + by}`,
    `L ${midX + tailHalfW} ${bh + by}`,
    `L ${midX} ${bh + tailH + by}`,
    `L ${midX - tailHalfW} ${bh + by}`,
    `L ${r + bx} ${bh + by}`,
    `A ${r} ${r} 0 0 1 ${bx} ${r + by}`,
    `A ${r} ${r} 0 0 1 ${r + bx} ${by}`,
    "Z",
  ].join(" ");

  const bubbleFill   = active ? "#111111" : "#FFFFFF";
  const bubbleStroke = active ? "#111111" : "#1E293B";
  const textFill     = active ? "#FFFFFF" : "#0F172A";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vbW}" height="${vbH}" viewBox="0 0 ${vbW} ${vbH}" fill="none">
  <ellipse cx="${vbW / 2}" cy="${vbH - 1.5}" rx="${Math.max(7, bw * 0.16)}" ry="2.3" fill="rgba(15,23,42,0.12)"/>
  <path d="${pinPath}" fill="${bubbleFill}" stroke="${bubbleStroke}" stroke-width="${sw}" stroke-linejoin="round"/>
  <text x="${midX}" y="${by + bh / 2 + 4.2}" text-anchor="middle" fill="${textFill}" font-size="12" font-family="Inter,Arial,sans-serif" font-weight="700" letter-spacing="-0.15">${priceText}</text>
</svg>`;
}

function createMarkerEl(price: number, active: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cursor = "pointer";
  el.innerHTML = buildMarkerSvg(price, active);
  return el;
}

// ─── Centre pin ──────────────────────────────────────────────────────────────

function createCenterPinEl(): HTMLDivElement {
  const el = document.createElement("div");
  // Brand-green teardrop. anchor="bottom" places the tail tip on the coordinate.
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38" fill="none">
    <ellipse cx="15" cy="36.5" rx="6" ry="2" fill="rgba(0,0,0,0.13)"/>
    <path d="M15 2C8.925 2 4 6.925 4 13c0 8.4 11 23 11 23S26 21.4 26 13C26 6.925 21.075 2 15 2Z" fill="#2ECC8F"/>
    <circle cx="15" cy="13" r="5" fill="white"/>
    <circle cx="15" cy="13" r="3.1" fill="#2ECC8F" stroke="#0B5B58" stroke-width="2.4"/>
  </svg>`;
  return el;
}

// ─── Distance-ring GeoJSON ───────────────────────────────────────────────────

/**
 * Builds a GeoJSON Polygon that approximates a circle of `radiusMeters`
 * around `[lng, lat]`. Uses a flat-earth approximation — accurate to <0.1 %
 * for radii under ~50 km.
 */
function buildRadiusPolygon(
  [lng, lat]: [number, number],
  radiusMeters: number,
  steps = 72,
) {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  const coords: [number, number][] = Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * 2 * Math.PI;
    return [
      lng + (radiusMeters / mPerDegLng) * Math.sin(angle),
      lat + (radiusMeters / mPerDegLat) * Math.cos(angle),
    ];
  });
  coords.push(coords[0]!); // close the ring
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [coords] },
    properties: {},
  };
}

const RADIUS_SOURCE = "cp-radius";
const RADIUS_FILL   = "cp-radius-fill";
const RADIUS_LINE   = "cp-radius-line";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clampZoom = (value: number, min?: number, max?: number) => {
  let z = value;
  if (typeof min === "number") z = Math.max(z, min);
  if (typeof max === "number") z = Math.min(z, max);
  return z;
};

// ─── Component ───────────────────────────────────────────────────────────────

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
  centerPinRadius,
  satellite = false,
  interactive = true,
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
      style: satellite
        ? "mapbox://styles/mapbox/satellite-streets-v12"
        : "mapbox://styles/mapbox/streets-v12",
      center: [defaultCenter.lng, defaultCenter.lat],
      zoom: initialZoom,
      interactive,
    });
    map.on("load", () => setMapReady(true));
    map.on("dragstart", () => { hasUserDraggedRef.current = true; });
    if (interactive) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), controlsPosition);
    }
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

  // Centre pin marker
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

  // Distance ring — GeoJSON fill + outline drawn on the map canvas
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const removeRing = () => {
      if (map.getLayer(RADIUS_FILL)) map.removeLayer(RADIUS_FILL);
      if (map.getLayer(RADIUS_LINE)) map.removeLayer(RADIUS_LINE);
      if (map.getSource(RADIUS_SOURCE)) map.removeSource(RADIUS_SOURCE);
    };

    if (!showCenterPin || !center || !centerPinRadius || centerPinRadius <= 0) {
      removeRing();
      return;
    }

    const data = buildRadiusPolygon([center.lng, center.lat], centerPinRadius);

    if (map.getSource(RADIUS_SOURCE)) {
      // Source already exists — just update its geometry in place (no layer flicker)
      (map.getSource(RADIUS_SOURCE) as mapboxgl.GeoJSONSource).setData(data);
      return;
    }

    map.addSource(RADIUS_SOURCE, { type: "geojson", data });

    map.addLayer({
      id: RADIUS_FILL,
      type: "fill",
      source: RADIUS_SOURCE,
      paint: {
        "fill-color": "#2ECC8F",
        "fill-opacity": 0.08,
      },
    });

    map.addLayer({
      id: RADIUS_LINE,
      type: "line",
      source: RADIUS_SOURCE,
      paint: {
        "line-color": "#2ECC8F",
        "line-width": 1.5,
        "line-opacity": 0.5,
        "line-dasharray": [3, 2],
      },
    });
  }, [mapReady, center, showCenterPin, centerPinRadius]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-slate-100"
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
