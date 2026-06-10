import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { Platform, StyleSheet, Vibration, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import MapView, {
  type EdgePadding,
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import ViewShot from "react-native-view-shot";
import { MapPricePin } from "./MapPricePin";
import { formatPriceValue } from "../utils/pricing";

type ListingResult = {
  id: string;
  title: string;
  address: string;
  price_per_day: number;
  price_per_hour?: number | null;
  rate_type?: "hourly" | "daily" | null;
  is_available?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ViewShotRef = InstanceType<typeof ViewShot>;

type MapRegion = Region;
const PIN_STYLE_VERSION = "v28";
const formatPinPrice = (value: number) => {
  return formatPriceValue(value);
};

function SearchOriginPin() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24">
      <Path
        fillRule="evenodd"
        d="M11.5397 22.351C11.57 22.3685 11.5937 22.3821 11.6105 22.3915L11.6384 22.4071C11.8613 22.5294 12.1378 22.5285 12.3608 22.4075L12.3895 22.3915C12.4063 22.3821 12.43 22.3685 12.4603 22.351C12.5207 22.316 12.607 22.265 12.7155 22.1982C12.9325 22.0646 13.2388 21.8676 13.6046 21.6091C14.3351 21.0931 15.3097 20.3274 16.2865 19.3273C18.2307 17.3368 20.25 14.3462 20.25 10.5C20.25 5.94365 16.5563 2.25 12 2.25C7.44365 2.25 3.75 5.94365 3.75 10.5C3.75 14.3462 5.76932 17.3368 7.71346 19.3273C8.69025 20.3274 9.66491 21.0931 10.3954 21.6091C10.7612 21.8676 11.0675 22.0646 11.2845 22.1982C11.393 22.265 11.4793 22.316 11.5397 22.351ZM12 13.5C13.6569 13.5 15 12.1569 15 10.5C15 8.84315 13.6569 7.5 12 7.5C10.3431 7.5 9 8.84315 9 10.5C9 12.1569 10.3431 13.5 12 13.5Z"
        fill="#0a8050"
      />
    </Svg>
  );
}

export default function MapSection({
  region,
  style,
  initialRegion,
  results,
  onSelect,
  onRegionChangeComplete,
  onRegionChange,
  onPanDrag,
  selectedId,
  provider,
  mapPadding,
  mapRef,
  freezeMarkers,
  onMapLoaded,
  onMapReady,
  googleMapId,
  customMapStyle,
  onOverlappingPins,
  priceForListing,
  priceKey,
  resumeNonce,
  searchPinCoordinate,
  onAllPinsRevealed,
  searchGeneration,
}: {
  region?: MapRegion;
  initialRegion: MapRegion;
  results: ListingResult[];
  style?: object;
  onSelect?: (id: string) => void;
  onRegionChangeComplete?: (nextRegion: MapRegion) => void;
  onRegionChange?: (nextRegion: MapRegion) => void;
  onPanDrag?: () => void;
  selectedId?: string | null;
  provider?: "google" | "default";
  mapPadding?: EdgePadding;
  mapRef?: Ref<MapView>;
  freezeMarkers?: boolean;
  onMapLoaded?: () => void;
  onMapReady?: () => void;
  googleMapId?: string;
  customMapStyle?: Array<Record<string, unknown>>;
  onOverlappingPins?: (pins: ListingResult[]) => void;
  priceForListing?: (listing: ListingResult) => number;
  priceKey?: string;
  resumeNonce?: number;
  searchPinCoordinate?: { latitude: number; longitude: number } | null;
  onAllPinsRevealed?: () => void;
  searchGeneration?: number;
}) {
  const nextResults = useMemo(
    () =>
      results.filter(
        (listing) =>
          typeof listing.latitude === "number" && typeof listing.longitude === "number"
      ),
    [results]
  );
  const renderedResultsRef = useRef(nextResults);
  const captureRefs = useRef(new Map<string, ViewShotRef>());
  const pendingCaptures = useRef(new Set<string>());
  const stableImagesRef = useRef<Record<string, string>>({});
  const localMapRef = useRef<MapView | null>(null);
  const lastRegionRef = useRef<MapRegion>(region ?? initialRegion);
  const lastMarkerPressRef = useRef<number>(0);
  const [pinImages, setPinImages] = useState<Record<string, string>>({});
  const [pinsReady, setPinsReady] = useState(false);
  const [pinsVisible, setPinsVisible] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const hasEverShownPins = useRef(false);
  const nextResultsRef = useRef(nextResults);
  nextResultsRef.current = nextResults;
  const pinLabelById = useMemo(
    () =>
      nextResults.reduce<Record<string, string>>((acc, listing) => {
        const priceValue = priceForListing
          ? priceForListing(listing)
          : Number(listing.price_per_day);
        acc[listing.id] =
          listing.is_available === false
            ? "Sold out"
            : `€${formatPinPrice(priceValue)}`;
        return acc;
      }, {}),
    [nextResults, priceForListing]
  );
  const labelKeys = useMemo(() => {
    const labels = Array.from(new Set(Object.values(pinLabelById)));
    const keys: string[] = [];
    labels.forEach((label) => {
      keys.push(`${label}|default|${PIN_STYLE_VERSION}|${priceKey ?? "base"}`);
      keys.push(`${label}|selected|${PIN_STYLE_VERSION}|${priceKey ?? "base"}`);
    });
    return keys;
  }, [pinLabelById, priceKey]);
  const providerValue =
    provider === "google"
      ? PROVIDER_GOOGLE
      : provider === "default"
        ? PROVIDER_DEFAULT
        : undefined;

  if (region) {
    lastRegionRef.current = region;
  }

  const attachMapRef = (instance: MapView | null) => {
    localMapRef.current = instance;
    if (!mapRef) return;
    if (typeof mapRef === "function") {
      mapRef(instance);
      return;
    }
    (mapRef as React.MutableRefObject<MapView | null>).current = instance;
  };
  useEffect(() => {
    if (freezeMarkers && renderedResultsRef.current.length) return;
    renderedResultsRef.current = nextResults;
  }, [nextResults, freezeMarkers]);
  useEffect(() => {
    // Only evict stale images once every key in the new label set has been captured.
    // This keeps old pin images alive during the capture gap so pins never flash away.
    const newSetReady = labelKeys.every((key) => Boolean(pinImages[key]));
    if (!newSetReady) {
      setPinsReady(false);
      // Only hide on first load — once pins have been shown keep them visible
      // so existing markers stay up while new captures run
      if (!hasEverShownPins.current) setPinsVisible(false);
      return;
    }
    setPinsReady(true);
    setPinImages((prev) => {
      const next: Record<string, string> = {};
      let changed = false;
      Object.entries(prev).forEach(([key, value]) => {
        if (labelKeys.includes(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [labelKeys, pinImages]);

  useEffect(() => {
    if (!pinsReady) return;
    // Commit stable fallback images (keyed without priceKey) so pins stay
    // visible during the next recapture cycle (e.g. when time changes).
    const stable: Record<string, string> = {};
    Object.entries(pinImages).forEach(([key, uri]) => {
      const stableKey = key.split("|").slice(0, 3).join("|");
      stable[stableKey] = uri;
    });
    stableImagesRef.current = stable;
    const timer = setTimeout(() => {
      hasEverShownPins.current = true;
      setPinsVisible(true);
    }, 32);
    return () => clearTimeout(timer);
  }, [pinsReady, pinImages]);

  useEffect(() => {
    labelKeys.forEach((key) => {
      if (pinImages[key] || pendingCaptures.current.has(key)) return;
      const ref = captureRefs.current.get(key);
      if (!ref) return;
      pendingCaptures.current.add(key);
      void ref
        .capture?.()
        .then((uri: string | undefined) => {
          if (!uri) return;
          setPinImages((prev) => ({ ...prev, [key]: uri }));
        })
        .finally(() => {
          pendingCaptures.current.delete(key);
        });
    });
  }, [labelKeys, pinImages]);

  // Stagger markers in one by one as pinsReady flips true after each search.
  // Also keyed on the result id set: results land after searchGeneration bumps,
  // and if their labels were already captured pinsReady never toggles — without
  // this key the new ids would never enter revealedIds and their pins never draw.
  const resultIdsKey = useMemo(
    () => nextResults.map((listing) => listing.id).join("|"),
    [nextResults]
  );
  useEffect(() => {
    if (!pinsReady) {
      if (!hasEverShownPins.current) setRevealedIds(new Set());
      return;
    }
    const listings = nextResultsRef.current;
    const STAGGER_MS = 40;
    const MAX_STAGGERED = 12;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Keep markers that are still in the new result set immediately visible
    setRevealedIds(prev => {
      const keep = new Set<string>();
      prev.forEach(id => { if (listings.some(l => l.id === id)) keep.add(id); });
      return keep;
    });
    listings.forEach((listing, i) => {
      timers.push(
        setTimeout(() => {
          setRevealedIds(prev => { const s = new Set(prev); s.add(listing.id); return s; });
        }, i < MAX_STAGGERED ? i * STAGGER_MS : MAX_STAGGERED * STAGGER_MS)
      );
    });
    // Fire after the last stagger timer so the caller can dismiss the loading indicator
    const lastStaggerMs = listings.length === 0
      ? 0
      : (listings.length <= MAX_STAGGERED
          ? (listings.length - 1) * STAGGER_MS
          : MAX_STAGGERED * STAGGER_MS);
    const doneTimer = setTimeout(() => { onAllPinsRevealed?.(); }, lastStaggerMs + 60);
    return () => { timers.forEach(clearTimeout); clearTimeout(doneTimer); };
  }, [pinsReady, searchGeneration, resultIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const getPinKey = (label: string, selected: boolean) =>
    `${label}|${selected ? "selected" : "default"}|${PIN_STYLE_VERSION}|${priceKey ?? "base"}`;
  return (
    <View style={styles.container}>
      <MapView
        style={[styles.map, style]}
        ref={attachMapRef}
        provider={providerValue}
        initialRegion={initialRegion}
        region={region}
        cacheEnabled={Platform.OS !== "android"}
        loadingEnabled
        loadingBackgroundColor="#F9FAFB"
        onRegionChange={(nextRegion) => {
          lastRegionRef.current = nextRegion;
          onRegionChange?.(nextRegion);
        }}
        onPanDrag={onPanDrag}
        onRegionChangeComplete={(nextRegion) => {
          lastRegionRef.current = nextRegion;
          onRegionChangeComplete?.(nextRegion);
        }}
        onMapLoaded={onMapLoaded}
        onMapReady={onMapReady}
        googleMapId={googleMapId}
        customMapStyle={customMapStyle as any}
        onPress={() => {
          if (!onSelect) return;
          // If a marker was just pressed, ignore this map press to avoid deselecting
          if (Date.now() - lastMarkerPressRef.current < 400) return;
          onOverlappingPins?.([]);
          onSelect(null as any);
        }}
        mapPadding={mapPadding}
        moveOnMarkerPress={false}
        mapType="standard"
      >
        {searchPinCoordinate ? (
          <Marker
            key={`search-pin-${searchPinCoordinate.latitude.toFixed(6)}-${searchPinCoordinate.longitude.toFixed(6)}`}
            coordinate={searchPinCoordinate}
            anchor={{ x: 0.5, y: 0.94 }}
            tracksViewChanges={false}
            zIndex={5}
          >
            <SearchOriginPin />
          </Marker>
        ) : null}
        {pinsVisible && (freezeMarkers ? renderedResultsRef.current : nextResults).map((listing) => {
          if (!revealedIds.has(listing.id)) return null;
          const isSelected = selectedId === listing.id;
          const price = priceForListing ? priceForListing(listing) : Number(listing.price_per_day);
          const label = pinLabelById[listing.id] ?? `€${formatPinPrice(price)}`;
          const pinKey = getPinKey(label, isSelected);
          const stableKey = `${label}|${isSelected ? "selected" : "default"}|${PIN_STYLE_VERSION}`;
          const pinImage = pinImages[pinKey] ?? stableImagesRef.current[stableKey];
          if (!pinImage) return null;
          return (
            <Marker
              key={`marker-${listing.id}-${isSelected ? "sel" : "def"}-${PIN_STYLE_VERSION}-${resumeNonce ?? 0}`}
              coordinate={{
                latitude: listing.latitude as number,
                longitude: listing.longitude as number,
              }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.96 }}
              centerOffset={{ x: 0, y: isSelected ? -2 : 0 }}
              onPress={(e) => {
                e?.stopPropagation?.();
                lastMarkerPressRef.current = Date.now();
                if (Platform.OS === "android") Vibration.vibrate(8);
                onSelect?.(listing.id);
              }}
              zIndex={isSelected ? 1000000 : Math.round((90 - (listing.latitude as number)) * 10000)}
              image={{ uri: pinImage }}
              pinColor="transparent"
              tappable={true}
              stopPropagation={true}
            />
          );
        })}
      </MapView>
      <View style={styles.captureShell} pointerEvents="none">
        {labelKeys.map((key) => {
          const [label, state] = key.split("|");
          const selected = state === "selected";
          const isSoldOut = label === "Sold out";
          const price = isSoldOut ? 0 : parseFloat(label.replace(/[€,]/g, "")) || 0;
          return (
            <ViewShot
              key={key}
              ref={(ref) => {
                if (ref) {
                  captureRefs.current.set(key, ref);
                } else {
                  captureRefs.current.delete(key);
                }
              }}
              options={{ format: "png", result: "tmpfile", quality: 1 }}
              style={styles.capture}
            >
              <MapPricePin price={price} selected={selected} soldOut={isSoldOut} />
            </ViewShot>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  capture: {
    alignItems: "center",
    justifyContent: "center",
  },
  captureShell: {
    alignItems: "center",
    justifyContent: "center",
    left: -1000,
    opacity: 0,
    position: "absolute",
    top: -1000,
  },
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
