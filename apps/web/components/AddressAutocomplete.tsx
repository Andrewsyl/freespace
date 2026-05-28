"use client";

import { useEffect, useRef, useState } from "react";

export type PlaceResult = {
  address: string;
  lat: number;
  lng: number;
};

export function AddressAutocomplete({
  defaultValue,
  placeholder,
  onPlace,
  name,
  inputClassName,
  showLocationButton,
}: {
  defaultValue?: string;
  placeholder?: string;
  onPlace: (place: PlaceResult) => void;
  name?: string;
  inputClassName?: string;
  showLocationButton?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !(window as any).google?.maps?.places) return;

    const autocomplete = new (window as any).google.maps.places.Autocomplete(input, {
      fields: ["formatted_address", "geometry"],
      componentRestrictions: { country: "ie" },
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location || !place.formatted_address) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      onPlace({ address: place.formatted_address, lat, lng });
    });

    return () => {
      (window as any).google?.maps?.event?.clearInstanceListeners(autocomplete);
    };
  }, [onPlace]);

  // Force pac-container to match this component's container width
  useEffect(() => {
    const bodyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if ((node as HTMLElement).classList?.contains("pac-container")) {
            if (!containerRef.current) return;
            const pac = node as HTMLElement;
            const { width, left } = containerRef.current.getBoundingClientRect();
            pac.style.setProperty("width", `${width}px`, "important");
            pac.style.setProperty("left", `${left + window.scrollX}px`, "important");
          }
        }
      }
    });

    bodyObserver.observe(document.body, { childList: true });
    return () => bodyObserver.disconnect();
  }, []);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let address = "Current location";
        try {
          const key = (window as any).__GOOGLE_MAPS_KEY__ ?? "";
          if ((window as any).google?.maps?.Geocoder) {
            const geocoder = new (window as any).google.maps.Geocoder();
            await new Promise<void>((resolve) => {
              geocoder.geocode(
                { location: { lat: latitude, lng: longitude } },
                (results: any[], status: string) => {
                  if (status === "OK" && results?.[0]?.formatted_address) {
                    address = results[0].formatted_address;
                  }
                  resolve();
                }
              );
            });
          } else if (key) {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${key}`
            );
            const data = await res.json();
            if (data.results?.[0]?.formatted_address) {
              address = data.results[0].formatted_address;
            }
          }
        } catch {
          // fall back to "Current location" label
        }
        if (inputRef.current) inputRef.current.value = address;
        onPlace({ address, lat: latitude, lng: longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setLocationError("Location permission denied");
        } else {
          setLocationError("Could not get location");
        }
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder ?? "Search address"}
        className={inputClassName ?? "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none hover:border-brand-200"}
        style={{ fontFamily: '"Plus Jakarta Sans",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', fontWeight: 600 }}
        onBlur={(e) => {
          if ((window as any).google?.maps?.places) return;
          if (!e.target.value) return;
          // Fallback: emit typed address with default coords only if nothing was set yet.
          onPlace({ address: e.target.value, lat: 53.3498, lng: -6.2603 });
        }}
      />
      {showLocationButton && (
        <button
          type="button"
          title={locating ? "Finding your location…" : "Use my current location"}
          onClick={handleUseLocation}
          disabled={locating}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-brand-50 hover:text-brand-600 disabled:opacity-60"
        >
          {locating ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2" strokeLinecap="round" />
              <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
            </svg>
          )}
        </button>
      )}
      {locationError && (
        <p className="absolute left-0 top-full mt-1 text-xs font-medium text-rose-600">{locationError}</p>
      )}
    </div>
  );
}
