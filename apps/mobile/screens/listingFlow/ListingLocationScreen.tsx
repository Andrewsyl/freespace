import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { MapPinned, Search, X } from "lucide-react-native";
import { MapPin } from "../../components/MapPin";
import { LIGHT_MAP_STYLE } from "../../components/mapStyles";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { hostFlowColors } from "./hostFlowTheme";
import { TextInput as AppTextInput } from "../../components/ui";
import { colors, radius, spacing, textStyles } from "../../styles/theme";
import { FlowFooter } from "./FlowFooter";

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
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [query, setQuery] = useState(draft.location.address);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);
  const isTypingRef = useRef(false);
  const skipAutocompleteRef = useRef(0);

  const initialRegion: Region = {
    latitude: draft.location.latitude || 53.3498,
    longitude: draft.location.longitude || -6.2603,
    latitudeDelta: 0.0005,
    longitudeDelta: 0.0005,
  };

  const [mapVisible, setMapVisible] = useState(draft.location.address.trim().length > 0);
  const hasLocation = draft.location.address.trim().length > 0;

  useEffect(() => {
    if (!mapsKey) return;
    if (skipAutocompleteRef.current > 0) {
      skipAutocompleteRef.current -= 1;
      return;
    }
    if (!isTypingRef.current || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => void fetchAutocomplete(query), 300);
    return () => clearTimeout(handle);
  }, [query, mapsKey]);

  const fetchAutocomplete = async (value: string) => {
    if (!mapsKey) return;
    try {
      const params = new URLSearchParams({ input: value, key: mapsKey, components: "country:ie" });
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
      const payload = (await res.json()) as { predictions?: PlaceSuggestion[] };
      setSuggestions(payload.predictions ?? []);
    } catch {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    if (!mapsKey) return;
    setLoading(true);
    Keyboard.dismiss();
    isTypingRef.current = false;
    setSuggestions([]);
    try {
      const params = new URLSearchParams({ place_id: suggestion.place_id, key: mapsKey, fields: "geometry,formatted_address" });
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
      const payload = (await res.json()) as PlaceDetailsResponse;
      const loc = payload.result?.geometry?.location;
      if (loc) {
        const address = payload.result?.formatted_address ?? suggestion.description;
        skipAutocompleteRef.current = 2;
        setMapVisible(true);
        setDraft((prev) => ({ ...prev, location: { address, latitude: loc.lat, longitude: loc.lng } }));
        setQuery(address);
        mapRef.current?.animateToRegion(
          { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.0005, longitudeDelta: 0.0005 },
          400
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChangeComplete = (next: Region) => {
    setDraft((prev) => ({ ...prev, location: { ...prev.location, latitude: next.latitude, longitude: next.longitude } }));
  };

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={1} total={8} onClose={exitFlow} />
      {/* Compact header */}
      <View style={styles.header}>
        <Text style={styles.kicker}>Find your space</Text>
        <Text style={styles.title}>Confirm location</Text>
      </View>

      {/* Map fills remaining space */}
      <View style={styles.mapShell}>
        {mapVisible ? (
          <>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              initialRegion={initialRegion}
              provider={PROVIDER_GOOGLE}
              mapType="satellite"
              customMapStyle={LIGHT_MAP_STYLE}
              onRegionChangeComplete={(region) => void handleRegionChangeComplete(region)}
            />

            {/* Pin always at map centre */}
            <View style={styles.centerPin} pointerEvents="none">
              <MapPin />
            </View>

            {/* Drag hint pill at bottom of map */}
            <View style={styles.dragHintWrap} pointerEvents="none">
              <View style={styles.dragHint}>
                <Text style={styles.dragHintText}>Drag map to position pin</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.mapPlaceholder} pointerEvents="none">
            <View style={styles.mapPlaceholderIconCircle}>
              <MapPinned size={38} color={colors.accent} strokeWidth={2} />
            </View>
            <Text style={styles.mapPlaceholderTitle}>Search for your address</Text>
            <Text style={styles.mapPlaceholderText}>
              Type your street address above and select it from the results
            </Text>
          </View>
        )}

        {/* Floating search overlay */}
        <View style={styles.searchOverlay} pointerEvents="box-none">
          <View style={styles.searchField}>
            <Search size={18} color={colors.accent} style={styles.searchIcon} strokeWidth={2.2} />
            <AppTextInput
              containerStyle={styles.searchInputContainer}
              variant="embedded"
              style={styles.searchInput}
              value={query}
              onChangeText={(text) => {
                isTypingRef.current = true;
                setQuery(text);
              }}
              onBlur={() => { isTypingRef.current = false; }}
              placeholder="Search address…"
            />
            {query ? (
              <Pressable
                style={styles.clearButton}
                onPress={() => {
                  setQuery("");
                  setSuggestions([]);
                  isTypingRef.current = false;
                }}
              >
                <X size={16} color={colors.textSoft} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </View>

          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.slice(0, 4).map((suggestion, index) => {
                const commaIdx = suggestion.description.indexOf(",");
                const mainText = commaIdx > -1 ? suggestion.description.slice(0, commaIdx) : suggestion.description;
                const secondaryText = commaIdx > -1 ? suggestion.description.slice(commaIdx + 1).trim() : "";
                return (
                  <Pressable
                    key={suggestion.place_id}
                    style={[styles.suggestionItem, index === suggestions.slice(0, 4).length - 1 && styles.suggestionItemLast]}
                    onPress={() => void handleSelectSuggestion(suggestion)}
                  >
                    <View style={styles.suggestionIconCircle}>
                      <MapPinned size={15} color={hostFlowColors.accent} strokeWidth={2.2} />
                    </View>
                    <View style={styles.suggestionCopy}>
                      <Text style={styles.suggestionText}>{mainText}</Text>
                      {secondaryText ? <Text style={styles.suggestionSubText}>{secondaryText}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <FlowFooter
        onBack={() => navigation.goBack()}
        primaryLabel={loading ? "Loading…" : "Confirm location"}
        onPrimary={() => navigation.navigate("ListingStreetView")}
        primaryDisabled={loading || !hasLocation}
      />
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
    paddingTop: 28,
    paddingBottom: 8,
  },
  kicker: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: hostFlowColors.text,
    fontSize: 26,
    lineHeight: 34,
    fontFamily: "PlusJakartaSans-Bold",
    marginTop: 10,
    letterSpacing: -0.8,
  },

  // Map fills all remaining space
  mapShell: {
    flex: 1,
    position: "relative",
  },

  // Pin locked to centre of mapShell
  centerPin: {
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -18 }, { translateY: -36 }],
  },

  // Placeholder (shown before address is selected)
  mapPlaceholder: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: 14,
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  mapPlaceholderIconCircle: {
    alignItems: "center",
    backgroundColor: hostFlowColors.accentSoft,
    borderColor: hostFlowColors.accentSoftBorder,
    borderRadius: 999,
    borderWidth: 2,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  mapPlaceholderTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
  mapPlaceholderText: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },

  // Drag hint pill at bottom
  dragHintWrap: {
    alignItems: "center",
    bottom: 20,
    left: 0,
    position: "absolute",
    right: 0,
  },
  dragHint: {
    backgroundColor: "rgba(15, 23, 42, 0.68)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  dragHintText: {
    color: "#ffffff",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: 0.1,
  },

  // Floating search bar + suggestions overlay
  searchOverlay: {
    left: 16,
    position: "absolute",
    right: 16,
    top: 12,
    zIndex: 10,
  },
  searchField: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
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
    fontSize: 16,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400",
    lineHeight: 22,
    minHeight: 22,
    includeFontPadding: false,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: radius.pill,
    height: 26,
    justifyContent: "center",
    width: 26,
  },

  // Suggestions list (floats below search bar)
  suggestions: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    marginTop: 8,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  suggestionItem: {
    alignItems: "center",
    borderBottomColor: "rgba(17, 24, 39, 0.06)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
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
    marginTop: 2,
  },

  // Footer
  footer: {
    backgroundColor: hostFlowColors.cardBg,
    borderTopColor: hostFlowColors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 10,
    paddingBottom: 2,
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
    alignItems: "center",
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
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
});
