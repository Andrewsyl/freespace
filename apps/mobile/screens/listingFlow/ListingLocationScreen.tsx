import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { MapPinned, Search } from "lucide-react-native";
import { MapPin } from "../../components/MapPin";
import { LIGHT_MAP_STYLE } from "../../components/mapStyles";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { hostFlowColors } from "./hostFlowTheme";
import { colors } from "../../styles/theme";
import { TextInput as AppTextInput } from "../../components/ui";
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

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;

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

      {/* Map fills all remaining space below the header */}
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
            <View style={styles.centerPin} pointerEvents="none">
              <MapPin />
            </View>
            <View style={styles.dragHintWrap} pointerEvents="none">
              <View style={styles.dragHint}>
                <Text style={styles.dragHintText}>Drag map to position pin</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.mapPlaceholder} pointerEvents="none">
            <View style={styles.mapPlaceholderIconCircle}>
              <MapPinned size={38} color={ACCENT} strokeWidth={2} />
            </View>
            <Text style={styles.mapPlaceholderTitle}>Search for your address</Text>
            <Text style={styles.mapPlaceholderText}>
              Type your street address above and select it from the results
            </Text>
          </View>
        )}

        {/* Floating overlay: search card + suggestions */}
        <View style={styles.searchOverlay} pointerEvents="box-none">
          {/* Search card */}
          <View style={styles.searchCard}>
            <View style={styles.searchCardHeader}>
              <Text style={styles.searchCardKicker}>Step 1 · Location</Text>
              <Text style={styles.searchCardTitle}>Confirm your parking spot</Text>
            </View>
            <View style={styles.searchInputRow}>
              <Search size={18} color={ACCENT} strokeWidth={2.2} />
              <AppTextInput
                containerStyle={styles.searchInputContainer}
                variant="embedded"
                style={styles.searchInput}
                value={query}
                onChangeText={(text) => {
                  isTypingRef.current = true;
                  setQuery(text);
                  if (!text) setSuggestions([]);
                }}
                onBlur={() => { isTypingRef.current = false; }}
                placeholder="Search address…"
              />
            </View>
          </View>

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.slice(0, 4).map((suggestion, index) => {
                const commaIdx = suggestion.description.indexOf(",");
                const mainText = commaIdx > -1 ? suggestion.description.slice(0, commaIdx) : suggestion.description;
                const secondaryText = commaIdx > -1 ? suggestion.description.slice(commaIdx + 1).trim() : "";
                return (
                  <Pressable
                    key={suggestion.place_id}
                    style={[
                      styles.suggestionItem,
                      index === suggestions.slice(0, 4).length - 1 && styles.suggestionItemLast,
                    ]}
                    onPress={() => void handleSelectSuggestion(suggestion)}
                  >
                    <View style={styles.suggestionIconCircle}>
                      <MapPinned size={15} color={ACCENT} strokeWidth={2.2} />
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
    backgroundColor: hostFlowColors.bg,
    flex: 1,
  },

  mapShell: {
    flex: 1,
    position: "relative",
  },

  centerPin: {
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -18 }, { translateY: -36 }],
  },

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
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
  mapPlaceholderText: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },

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
    color: colors.textInverse,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: 0.1,
  },

  searchOverlay: {
    left: 16,
    position: "absolute",
    right: 16,
    top: 12,
    zIndex: 10,
  },

  // Search card: header (kicker+title) + input row
  searchCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
  searchCardHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: hostFlowColors.border,
  },
  searchCardKicker: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  searchCardTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 18,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  searchInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flex: 1,
    marginBottom: 0,
    justifyContent: "center",
  },
  searchInput: {
    color: FG,
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400",
    lineHeight: 22,
    minHeight: 22,
    includeFontPadding: false,
    paddingVertical: 0,
  },
  suggestions: {
    backgroundColor: hostFlowColors.cardBg,
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
    backgroundColor: hostFlowColors.accentSoft,
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
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },
  suggestionSubText: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
