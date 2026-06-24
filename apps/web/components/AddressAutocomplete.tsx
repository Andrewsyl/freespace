"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export type PlaceResult = {
  address: string;
  lat: number;
  lng: number;
};

const RECENT_KEY = "fs_recent_locations";
const MAX_RECENT = 5;

type RecentPlace = { address: string; lat: number; lng: number };

function loadRecents(): RecentPlace[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
  catch { return []; }
}

function saveRecent(place: RecentPlace) {
  try {
    const existing = loadRecents().filter((r) => r.address !== place.address);
    localStorage.setItem(RECENT_KEY, JSON.stringify([place, ...existing].slice(0, MAX_RECENT)));
  } catch {}
}

function removeRecent(address: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(loadRecents().filter((r) => r.address !== address)));
  } catch {}
}

export function AddressAutocomplete({
  defaultValue,
  placeholder,
  onPlace,
  onInputChange,
  name,
  inputClassName,
  showLocationButton,
}: {
  defaultValue?: string;
  placeholder?: string;
  onPlace: (place: PlaceResult) => void;
  onInputChange?: (value: string) => void;
  name?: string;
  inputClassName?: string;
  showLocationButton?: boolean;
}) {
  const inputRef      = useRef<HTMLInputElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const svcRef        = useRef<any>(null);
  const plcRef        = useRef<any>(null);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query,       setQuery]       = useState(defaultValue ?? "");
  const [predictions, setPredictions] = useState<any[]>([]);
  const [recents,     setRecents]     = useState<RecentPlace[]>([]);
  const [open,        setOpen]        = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [locating,    setLocating]    = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Init Google services — retries until Maps SDK loads (deferred with afterInteractive)
  useEffect(() => {
    const tryInit = () => {
      if (!(window as any).google?.maps?.places) return false;
      svcRef.current = new (window as any).google.maps.places.AutocompleteService();
      const div = document.createElement("div");
      document.body.appendChild(div);
      plcRef.current = new (window as any).google.maps.places.PlacesService(div);
      return true;
    };
    if (!tryInit()) {
      const id = setInterval(() => { if (tryInit()) clearInterval(id); }, 200);
      return () => clearInterval(id);
    }
  }, []);

  // Autocomplete predictions
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    if (!q || !svcRef.current) { setPredictions([]); return; }
    timerRef.current = setTimeout(() => {
      svcRef.current.getPlacePredictions(
        { input: q, componentRestrictions: { country: "ie" } },
        (preds: any[], status: string) => {
          setPredictions(status === "OK" && preds?.length ? preds.slice(0, 6) : []);
        }
      );
    }, 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const handleSelect = useCallback((place: PlaceResult) => {
    saveRecent(place);
    setQuery(place.address);
    setPredictions([]);
    setOpen(false);
    onPlace(place);
  }, [onPlace]);

  const pickPrediction = (pred: any) => {
    if (plcRef.current) {
      plcRef.current.getDetails(
        { placeId: pred.place_id, fields: ["geometry", "formatted_address"] },
        (place: any, status: string) => {
          if (status === "OK" && place.geometry?.location) {
            handleSelect({ address: place.formatted_address ?? pred.description, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
          } else {
            handleSelect({ address: pred.description, lat: 53.3498, lng: -6.2603 });
          }
        }
      );
    } else {
      handleSelect({ address: pred.description, lat: 53.3498, lng: -6.2603 });
    }
  };

  const updateRect = useCallback(() => {
    if (!containerRef.current) return;
    const inputRect = containerRef.current.getBoundingClientRect();
    // Walk up to find the first ancestor that's meaningfully wider (the full search box)
    let anchor = inputRect;
    let el: HTMLElement | null = containerRef.current.parentElement;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.width > inputRect.width + 24) { anchor = r; break; }
      el = el.parentElement;
    }
    setDropdownRect({ top: inputRect.bottom, left: anchor.left, width: anchor.width });
  }, []);

  const handleFocus = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setRecents(loadRecents());
    updateRect();
    setOpen(true);
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setOpen(false), 150);
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) { setLocationError("Geolocation not supported"); return; }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let address = "Current location";
        try {
          if ((window as any).google?.maps?.Geocoder) {
            const geocoder = new (window as any).google.maps.Geocoder();
            await new Promise<void>((resolve) => {
              geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any[], status: string) => {
                if (status === "OK" && results?.[0]?.formatted_address) address = results[0].formatted_address;
                resolve();
              });
            });
          }
        } catch {}
        handleSelect({ address, lat: latitude, lng: longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocationError(err.code === 1 ? "Location permission denied" : "Could not get location");
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  const showDropdown = open && (predictions.length > 0 || (recents.length > 0 && !query.trim()));
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        name={name}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onInputChange?.(e.target.value);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder ?? "Search address"}
        autoComplete="off"
        className={inputClassName ?? "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none hover:border-brand-200"}
        style={{ fontFamily: 'var(--font-plus-jakarta-sans), system-ui, -apple-system, sans-serif', fontWeight: 600 }}
      />

      {showLocationButton && (
        <button
          type="button"
          title={locating ? "Finding your location…" : "Use my current location"}
          onClick={handleUseLocation}
          disabled={locating}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-brand-50 hover:text-brand-600 disabled:opacity-60"
        >
          {locating ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      )}

      {locationError && (
        <p className="absolute left-0 top-full mt-1 text-xs font-medium text-rose-600">{locationError}</p>
      )}

      {/* Custom dropdown — portalled to body to escape overflow:hidden parents */}
      {showDropdown && mounted && dropdownRect && createPortal(
        <div
          style={{ position: "fixed", top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 9999 }}
          className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)]"
        >
          {!query.trim() && recents.length > 0 ? (
            <>
              <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">Recent</p>
              {recents.map((r) => (
                <div key={r.address} className="flex items-center">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                    className="flex flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  >
                    <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="truncate text-[14px] font-semibold text-slate-800">{r.address}</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); removeRecent(r.address); setRecents(loadRecents()); }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-300 transition hover:text-slate-500"
                    aria-label="Remove"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          ) : predictions.map((pred) => {
            const main      = pred.structured_formatting?.main_text ?? pred.description;
            const secondary = pred.structured_formatting?.secondary_text ?? "";
            return (
              <button
                key={pred.place_id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pickPrediction(pred); }}
                className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left transition first:border-t-0 hover:bg-slate-50"
              >
                <svg className="h-4 w-4 shrink-0 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" />
                </svg>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{main}</p>
                  {secondary && <p className="truncate text-[12px] text-slate-600">{secondary}</p>}
                </div>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
