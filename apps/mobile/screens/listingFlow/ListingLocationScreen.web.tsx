import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
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
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [query, setQuery] = useState(draft.location.address);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const skipAutocompleteRef = useRef(0);
  const canConfirm = draft.location.address.trim().length > 0;

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
      }
    } finally {
      setLoading(false);
      setSuggestions([]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Find your space</Text>
        <StepProgress current={1} total={8} />
        <Text style={styles.title}>Confirm location</Text>
        <Text style={styles.subtitle}>
          Map preview is available on device. You can still set the address here.
        </Text>
      </View>
      <View style={styles.searchShell}>
        <View style={styles.searchField}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search address"
            placeholderTextColor={colors.textDisabled}
          />
          {query ? (
            <Pressable
              style={styles.clearButton}
              onPress={() => {
                setQuery("");
                setSuggestions([]);
              }}
            >
              <Text style={styles.clearButtonText}>×</Text>
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
                    <Text style={styles.suggestionIconPin}>📍</Text>
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
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Map preview is available on device.</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !canConfirm && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingStreetView")}
          disabled={loading || !canConfirm}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Loading..." : "Confirm location"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
  },
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  searchShell: {
    paddingHorizontal: spacing.screenX,
    marginTop: 12,
  },
  searchField: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    borderRadius: radius.pill,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  clearButtonText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 18,
  },
  suggestions: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: spacing.screenX,
    marginTop: 8,
    overflow: "hidden",
  },
  suggestionItem: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  suggestionIconCircle: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: 18,
    flexShrink: 0,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  suggestionIconPin: {
    fontSize: 14,
  },
  suggestionCopy: {
    flex: 1,
  },
  suggestionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  suggestionSubText: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 1,
  },
  suggestionMuted: {
    color: colors.textSoft,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mapShell: {
    flex: 1,
    marginTop: 12,
    paddingHorizontal: spacing.screenX,
  },
  mapPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    borderRadius: radius.card,
    flex: 1,
    justifyContent: "center",
  },
  mapPlaceholderText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.border,
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontWeight: "600",
  },
});
