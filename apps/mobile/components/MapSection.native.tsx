import { useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, {
  type EdgePadding,
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
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

type MapRegion = Region;

const formatPinPrice = (value: number) => Math.round(value).toString();

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
  mapRef?: React.Ref<MapView>;
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
  const localMapRef = useRef<MapView | null>(null);
  const lastRegionRef = useRef<MapRegion>(region ?? initialRegion);
  const lastMarkerPressRef = useRef<number>(0);

  if (region) {
    lastRegionRef.current = region;
  }

  if (!freezeMarkers || !renderedResultsRef.current.length) {
    renderedResultsRef.current = nextResults;
  }

  const providerValue =
    provider === "google"
      ? PROVIDER_GOOGLE
      : provider === "default"
        ? PROVIDER_DEFAULT
        : undefined;

  const attachMapRef = (instance: MapView | null) => {
    localMapRef.current = instance;
    if (!mapRef) return;
    if (typeof mapRef === "function") {
      mapRef(instance);
      return;
    }
    (mapRef as React.MutableRefObject<MapView | null>).current = instance;
  };

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
          if (Date.now() - lastMarkerPressRef.current < 400) return;
          onOverlappingPins?.([]);
          onSelect(null as any);
        }}
        mapPadding={mapPadding}
        moveOnMarkerPress={false}
        mapType="standard"
      >
        {renderedResultsRef.current.filter((listing) => {
          const region = lastRegionRef.current;
          const lat = listing.latitude as number;
          const lng = listing.longitude as number;
          const halfLat = region.latitudeDelta / 2;
          const halfLng = region.longitudeDelta / 2;
          return (
            lat >= region.latitude - halfLat &&
            lat <= region.latitude + halfLat &&
            lng >= region.longitude - halfLng &&
            lng <= region.longitude + halfLng
          );
        }).map((listing) => {
          const isSelected = selectedId === listing.id;
          const price = priceForListing ? priceForListing(listing) : Number(listing.price_per_day);
          const isSoldOut = listing.is_available === false;
          const pinPrice = isSoldOut ? 0 : parseFloat(formatPinPrice(price));

          return (
            <Marker
              key={`marker-${listing.id}-${isSelected ? "sel" : "def"}`}
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
              tappable={true}
              stopPropagation={true}
            >
              <MapPricePin price={pinPrice} selected={isSelected} soldOut={isSoldOut} />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
