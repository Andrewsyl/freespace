import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, {
  type EdgePadding,
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import ViewShot from "react-native-view-shot";
import { MapPricePin } from "./MapPricePin";

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
const PIN_STYLE_VERSION = "v20";
const formatPinPrice = (value: number) => {
  return Math.round(value).toString();
};

export default function MapSection({
  region,
  style,
  initialRegion,
  results,
  onSelect,
  onRegionChangeComplete,
  onRegionChange,
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
}: {
  region?: MapRegion;
  initialRegion: MapRegion;
  results: ListingResult[];
  style?: object;
  onSelect?: (id: string) => void;
  onRegionChangeComplete?: (nextRegion: MapRegion) => void;
  onRegionChange?: (nextRegion: MapRegion) => void;
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
  const localMapRef = useRef<MapView | null>(null);
  const lastRegionRef = useRef<MapRegion>(region ?? initialRegion);
  const lastMarkerPressRef = useRef<number>(0);
  const [pinImages, setPinImages] = useState<Record<string, string>>({});
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
      keys.push(`${label}|default|${PIN_STYLE_VERSION}`);
      keys.push(`${label}|selected|${PIN_STYLE_VERSION}`);
    });
    return keys;
  }, [pinLabelById]);
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
    if (!newSetReady) return;
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

  const getPinKey = (label: string, selected: boolean) =>
    `${label}|${selected ? "selected" : "default"}|${PIN_STYLE_VERSION}`;
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
        {(freezeMarkers ? renderedResultsRef.current : nextResults).map((listing) => {
          const isSelected = selectedId === listing.id;
          const price = priceForListing ? priceForListing(listing) : Number(listing.price_per_day);
          const label =
            pinLabelById[listing.id] ??
            `€${formatPinPrice(price)}`;
          const pinKey = getPinKey(label, isSelected);
          const pinImage = pinImages[pinKey];
          if (!pinImage) return null;
          return (
            <Marker
              key={`marker-${listing.id}-${isSelected ? "sel" : "def"}-${PIN_STYLE_VERSION}`}
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
                onSelect?.(listing.id);
              }}
              zIndex={isSelected ? 1000000 : Math.round((90 - (listing.latitude as number)) * 10000)}
              image={{ uri: pinImage }}
              pinColor="transparent"
              // Airbnb-style: Markers are always tappable
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
