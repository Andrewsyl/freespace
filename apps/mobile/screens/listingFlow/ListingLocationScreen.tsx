import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { MapPinned, Search, X } from "lucide-react-native";
import { MapPin } from "../../components/MapPin";
import { LIGHT_MAP_STYLE } from "../../components/mapStyles";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { hostFlowColors, hostFlowShadow } from "./hostFlowTheme";
import { TextInput as AppTextInput } from "../../components/ui";
import { colors, radius, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingLocation: undefined;
  ListingStreetView: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingLocation">;

type PlaceSuggestion = {
  description: string;
  place_id: string;
};

type PlaceDetailsResponse = {
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
};

export function ListingLocationScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [query, setQuery] = useState(draft.location.address);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [movePinMode, setMovePinMode] = useState(true);
  const [mapVisible, setMapVisible] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [showAddressPrompt, setShowAddressPrompt] = useState(false);
  const pendingCenterRef = useRef<Region | null>(null);
  const mapRef = useRef<MapView>(null);
  const skipAutocompleteRef = useRef(0);
  const ADDRESS_PROMPT_DISTANCE_M = 10;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
  };

  const region = useMemo<Region>(
    () => ({
      latitude: draft.location.latitude,
      longitude: draft.location.longitude,
      latitudeDelta: 0.0005,
      longitudeDelta: 0.0005,
    }),
    [draft.location.latitude, draft.location.longitude]
  );

  useEffect(() => {
    if (mapVisible) return;
    if (Platform.OS === "ios") {
      setMapVisible(true);
      return;
    }
    if (draft.location.address.trim().length > 0) {
      setMapVisible(true);
    }
  }, [draft.location.address, mapVisible]);

  useEffect(() => {
    if (!mapsKey) return;
    if (skipAutocompleteRef.current > 0) {
      skipAutocompleteRef.current -= 1;
      return;
    }
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      void fetchAutocomplete(query);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, mapsKey]);

  const fetchAutocomplete = async (value: string) => {
    if (!mapsKey) return;
    setAddressLoading(true);
    try {
      const params = new URLSearchParams({
        input: value,
        key: mapsKey,
        components: "country:ie",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
      );
      const payload = (await response.json()) as { predictions?: PlaceSuggestion[] };
      setSuggestions(payload.predictions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    if (!mapsKey) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        place_id: suggestion.place_id,
        key: mapsKey,
        fields: "geometry,formatted_address",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
      );
      const payload = (await response.json()) as PlaceDetailsResponse;
      const location = payload.result?.geometry?.location;
      if (location) {
        setMapVisible(true);
        skipAutocompleteRef.current = 2;
        setDraft((prev) => ({
          ...prev,
          location: {
            address: payload.result?.formatted_address ?? suggestion.description,
            latitude: location.lat,
            longitude: location.lng,
          },
        }));
        setQuery(payload.result?.formatted_address ?? suggestion.description);
        Keyboard.dismiss();
        mapRef.current?.animateToRegion(
          {
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: 0.0005,
            longitudeDelta: 0.0005,
          },
          400
        );
      }
    } finally {
      setLoading(false);
      setSuggestions([]);
    }
  };

  const formatReverseGeocode = (entry: Location.LocationGeocodedAddress) => {
    const parts = [
      entry.name,
      entry.street,
      entry.city,
      entry.region,
      entry.postalCode,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const finalizePinFromRegion = async (next: Region) => {
    const prevCoords = {
      lat: draft.location.latitude,
      lng: draft.location.longitude,
    };
    setMapVisible(true);
    setDraft((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        latitude: next.latitude,
        longitude: next.longitude,
      },
    }));
    setSuggestions([]);
    Keyboard.dismiss();
    try {
      const [first] = await Location.reverseGeocodeAsync({
        latitude: next.latitude,
        longitude: next.longitude,
      });
      if (first) {
        const label = formatReverseGeocode(first);
        const currentAddress = draft.location.address?.trim() ?? "";
        if (label && (!currentAddress || currentAddress === label)) {
          setDraft((prev) => ({
            ...prev,
            location: {
              ...prev.location,
              address: label,
            },
          }));
          setQuery(label);
          return;
        }
        if (label) {
          const movedMeters = distanceMeters(prevCoords, {
            lat: next.latitude,
            lng: next.longitude,
          });
          if (movedMeters < ADDRESS_PROMPT_DISTANCE_M) {
            return;
          }
          setPendingAddress(label);
          setShowAddressPrompt(true);
        }
      }
    } catch {
      // Ignore reverse geocode errors.
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Find your space</Text>
        <StepProgress current={1} total={8} />
        <Text style={styles.title}>Confirm location</Text>
        <Text style={styles.subtitle}>
          Drag the pin to your exact spot. You can change this later.
        </Text>
      </View>
      <View style={styles.searchShell}>
        <View style={styles.searchField}>
          <Search size={18} color={colors.accent} style={styles.searchIcon} strokeWidth={2.2} />
          <AppTextInput
            containerStyle={styles.searchInputContainer}
            variant="embedded"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search address"
          />
          {query ? (
            <Pressable
              style={styles.clearButton}
              onPress={() => {
                setQuery("");
                setSuggestions([]);
              }}
            >
              <X size={16} color={colors.textSoft} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {mapsKey && (addressLoading || suggestions.length > 0) ? (
        <View style={styles.suggestions}>
          {addressLoading ? (
            <Text style={styles.suggestionMuted}>Searching...</Text>
          ) : (
            suggestions.slice(0, 4).map((suggestion) => {
              const commaIdx = suggestion.description.indexOf(",");
              const mainText = commaIdx > -1 ? suggestion.description.slice(0, commaIdx) : suggestion.description;
              const secondaryText = commaIdx > -1 ? suggestion.description.slice(commaIdx + 1).trim() : "";
              return (
                <Pressable
                  key={suggestion.place_id}
                  style={styles.suggestionItem}
                  onPress={() => void handleSelectSuggestion(suggestion)}
                >
                  <View style={styles.suggestionIconCircle}>
                    <MapPinned size={15} color="#22c55e" strokeWidth={2.2} />
                  </View>
                  <View style={styles.suggestionCopy}>
                    <Text style={styles.suggestionText}>{mainText}</Text>
                    {secondaryText ? (
                      <Text style={styles.suggestionSubText}>{secondaryText}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
      <View style={styles.mapShell}>
        {mapVisible ? (
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={region}
              provider={PROVIDER_GOOGLE}
              mapType="satellite"
              customMapStyle={LIGHT_MAP_STYLE}
              onRegionChange={(nextRegion) => {
                if (movePinMode) pendingCenterRef.current = nextRegion;
              }}
              onRegionChangeComplete={(nextRegion) => {
                if (movePinMode) pendingCenterRef.current = nextRegion;
              }}
            >
              {!movePinMode ? (
                <Marker
                  draggable={movePinMode}
                  coordinate={{
                    latitude: draft.location.latitude,
                    longitude: draft.location.longitude,
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                  centerOffset={{ x: 0, y: -6 }}
                  onDragEnd={(event) => {
                    const { latitude, longitude } = event.nativeEvent.coordinate;
                    void finalizePinFromRegion({
                      latitude,
                      longitude,
                      latitudeDelta: region.latitudeDelta,
                      longitudeDelta: region.longitudeDelta,
                    });
                  }}
                >
                  <MapPin />
                </Marker>
              ) : null}
            </MapView>
            {movePinMode ? (
              <View style={styles.centerPin} pointerEvents="none">
                <MapPin />
              </View>
            ) : null}
            {showAddressPrompt && pendingAddress ? (
              <View style={styles.addressPrompt}>
                <Text style={styles.addressPromptTitle}>Update address?</Text>
                <Text style={styles.addressPromptBody}>We found a nearby address:</Text>
                <Text style={styles.addressPromptValue}>{pendingAddress}</Text>
                <View style={styles.addressPromptActions}>
                  <Pressable
                    style={styles.addressPromptGhost}
                    onPress={() => {
                      setShowAddressPrompt(false);
                      setPendingAddress(null);
                      setQuery(draft.location.address);
                    }}
                  >
                    <Text style={styles.addressPromptGhostText}>Keep original</Text>
                  </Pressable>
                  <Pressable
                    style={styles.addressPromptPrimary}
                    onPress={() => {
                      if (pendingAddress) {
                        setDraft((prev) => ({
                          ...prev,
                          location: {
                            ...prev.location,
                            address: pendingAddress,
                          },
                        }));
                        setQuery(pendingAddress);
                      }
                      setShowAddressPrompt(false);
                      setPendingAddress(null);
                    }}
                  >
                    <Text style={styles.addressPromptPrimaryText}>Use new address</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.mapControls}>
              <Pressable
                style={[styles.movePinToggle, movePinMode && styles.movePinToggleActive]}
                onPress={() => {
                  if (movePinMode) {
                    const next = pendingCenterRef.current;
                    if (next) void finalizePinFromRegion(next);
                    pendingCenterRef.current = null;
                  }
                  setMovePinMode((prev) => !prev);
                }}
              >
                <Text style={styles.movePinToggleText}>
                  {movePinMode ? "Drop pin" : "Move pin"}
                </Text>
              </Pressable>
              {movePinMode ? (
                <View style={styles.movePinHint}>
                  <Text style={styles.movePinHintText}>Drag the map to position</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.mapPlaceholder}>
            <View style={styles.mapPlaceholderIconCircle}>
              <MapPinned size={42} color={colors.accent} strokeWidth={2} />
            </View>
            <View style={styles.mapPlaceholderContent}>
              <Text style={styles.mapPlaceholderTitle}>No location selected</Text>
              <Text style={styles.mapPlaceholderText}>
                Search for an address above to preview your parking spot on the map
              </Text>
            </View>
          </View>
        )}
      </View>
      <View style={[styles.footer, { marginBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.footerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, !mapVisible && styles.primaryButtonDisabled]}
            onPress={() => navigation.navigate("ListingStreetView")}
            disabled={loading || !mapVisible}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Loading..." : "Confirm location"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: hostFlowColors.appBg,
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 0,
  },
  kicker: {
    ...textStyles.kicker,
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  title: {
    color: hostFlowColors.text,
    fontSize: 26,
    lineHeight: 31,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    marginTop: 12,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: hostFlowColors.textMuted,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400",
    marginTop: 8,
    lineHeight: 22,
  },
  searchShell: {
    paddingHorizontal: spacing.screenX,
    marginTop: 14,
  },
  searchField: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInputContainer: {
    flex: 1,
    marginBottom: 0,
    justifyContent: "center",
  },
  searchInput: {
    color: hostFlowColors.text,
    flex: 1,
    fontSize: 17,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400",
    lineHeight: 24,
    minHeight: 24,
    includeFontPadding: false,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBgMuted,
    borderRadius: radius.pill,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  clearButtonText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 20,
  },
  suggestions: {
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: spacing.screenX,
    marginTop: 10,
    overflow: "hidden",
  },
  suggestionItem: {
    alignItems: "center",
    borderBottomColor: "rgba(17, 24, 39, 0.06)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  suggestionIconCircle: {
    alignItems: "center",
    backgroundColor: "#e6f9f2",
    borderRadius: 20,
    flexShrink: 0,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  suggestionCopy: {
    flex: 1,
  },
  suggestionText: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },
  suggestionSubText: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    marginTop: 1,
  },
  suggestionMuted: {
    color: hostFlowColors.textSoft,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-Regular",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mapShell: {
    flex: 1,
    marginTop: 12,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBgMuted,
    borderColor: hostFlowColors.border,
    borderRadius: 22,
    borderStyle: "dashed",
    borderWidth: 2,
    flex: 1,
    gap: 20,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  mapPlaceholderIconCircle: {
    alignItems: "center",
    backgroundColor: hostFlowColors.accentSoft,
    borderColor: hostFlowColors.accentSoftBorder,
    borderRadius: 999,
    borderWidth: 2,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  mapPlaceholderContent: {
    alignItems: "center",
    gap: 8,
  },
  mapPlaceholderTitle: {
    color: hostFlowColors.text,
    fontSize: 16,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    textAlign: "center",
  },
  mapPlaceholderText: {
    color: hostFlowColors.textMuted,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-Regular",
    lineHeight: 22,
    textAlign: "center",
  },
  centerPin: {
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -18 }, { translateY: -36 }],
  },
  mapControls: {
    alignItems: "flex-end",
    left: 16,
    position: "absolute",
    right: 16,
    top: 12,
  },
  movePinToggle: {
    backgroundColor: "rgba(24, 52, 47, 0.88)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  movePinToggleActive: {
    backgroundColor: hostFlowColors.accent,
  },
  movePinToggleText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  movePinHint: {
    backgroundColor: "rgba(252, 248, 238, 0.94)",
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  movePinHintText: {
    color: hostFlowColors.text,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  addressPrompt: {
    backgroundColor: "rgba(252, 248, 238, 0.98)",
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    bottom: 14,
    left: 16,
    padding: 14,
    position: "absolute",
    right: 16,
  },
  addressPromptTitle: {
    color: hostFlowColors.text,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  addressPromptBody: {
    color: hostFlowColors.textMuted,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-Regular",
    marginTop: 6,
  },
  addressPromptValue: {
    color: hostFlowColors.text,
    fontSize: 13,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    marginTop: 4,
  },
  addressPromptActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  addressPromptGhost: {
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  addressPromptGhostText: {
    color: hostFlowColors.text,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    textAlign: "center",
  },
  addressPromptPrimary: {
    backgroundColor: hostFlowColors.accent,
    borderRadius: 10,
    flex: 1,
    paddingVertical: 10,
  },
  addressPromptPrimaryText: {
    color: colors.cardBg,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    textAlign: "center",
  },
  footer: {
    backgroundColor: hostFlowColors.cardBg,
    borderTopColor: hostFlowColors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 10,
    paddingBottom: 2,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: hostFlowColors.accent,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: hostFlowColors.textMuted,
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    fontWeight: '600',
  },
});
