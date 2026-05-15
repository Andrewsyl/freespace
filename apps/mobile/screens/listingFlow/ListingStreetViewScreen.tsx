import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { StepProgress } from "./StepProgress";
import { useListingFlow } from "./context";
import { cardShadow, colors, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingStreetView: undefined;
  ListingDetails: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingStreetView">;

export function ListingStreetViewScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const webViewRef = useRef<WebView>(null);
  const canUseView = Platform.OS !== "web" && !!mapsKey;
  const centerLat = draft.location.latitude;
  const centerLng = draft.location.longitude;
  const initialHeading = draft.coverHeading ?? 0;
  const initialPitch = draft.coverPitch ?? 0;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          html, body, #pano { margin: 0; padding: 0; width: 100%; height: 100%; background: #0f172a; }
        </style>
        <script src="https://maps.googleapis.com/maps/api/js?key=${mapsKey}"></script>
      </head>
      <body>
        <div id="pano"></div>
        <script>
          const pano = new google.maps.StreetViewPanorama(document.getElementById("pano"), {
            position: { lat: ${centerLat}, lng: ${centerLng} },
            pov: { heading: ${initialHeading}, pitch: ${initialPitch} },
            zoom: 0,
            motionTracking: false,
            fullscreenControl: false,
            addressControl: false,
            showRoadLabels: false
          });
          window.__getPov = () => pano.getPov();
        </script>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Street view</Text>
        <StepProgress current={2} total={7} />
        <Text style={styles.title}>Choose your cover image</Text>
        <Text style={styles.subtitle}>
          Pick the view that best represents the exact parking spot.
        </Text>
      </View>
      <View style={styles.viewer}>
        {Platform.OS === "web" ? (
          <View style={styles.webFallback}>
            <Text style={styles.webFallbackText}>
              Street View selection is available on mobile devices.
            </Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html }}
            javaScriptEnabled
            domStorageEnabled
            style={styles.webView}
            onMessage={(event) => {
              try {
                const payload = JSON.parse(event.nativeEvent.data) as {
                  type: string;
                  pov?: { heading: number; pitch: number };
                };
                if (payload.type === "pov" && payload.pov) {
                  const { pov } = payload;
                  setDraft((prev) => ({
                    ...prev,
                    coverHeading: Math.round(pov.heading),
                    coverPitch: Math.round(pov.pitch),
                  }));
                  navigation.navigate("ListingDetails");
                }
              } catch {
                // Ignore invalid messages.
              }
            }}
          />
        )}
      </View>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !canUseView && styles.primaryButtonDisabled]}
          onPress={() => {
            if (Platform.OS === "web") {
              navigation.navigate("ListingDetails");
              return;
            }
            const script =
              "window.ReactNativeWebView.postMessage(JSON.stringify({type:'pov', pov: window.__getPov ? window.__getPov() : null})); true;";
            webViewRef.current?.injectJavaScript(script);
          }}
          disabled={!canUseView}
        >
          <Text style={styles.primaryButtonText}>Use this view</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            setDraft((prev) => ({ ...prev, coverHeading: null }));
            navigation.navigate("ListingDetails");
          }}
        >
          <Text style={styles.secondaryButtonText}>Skip for now</Text>
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
    paddingTop: 0,
  },
  kicker: {
    ...textStyles.kicker,
    fontFamily: "Inter-SemiBold",
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 31,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    marginTop: 10,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: "#667085",
    fontSize: 14,
    fontFamily: "Inter-Regular",
    marginTop: 8,
    lineHeight: 22,
  },
  viewer: {
    marginTop: 16,
    marginHorizontal: spacing.screenX,
    borderRadius: 22,
    overflow: "hidden",
    borderColor: "rgba(17, 24, 39, 0.08)",
    borderWidth: 1,
    height: 288,
    ...cardShadow,
  },
  webView: {
    flex: 1,
  },
  webFallback: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  webFallbackText: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: "Inter-Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    marginTop: "auto",
    paddingHorizontal: spacing.screenX,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 8,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    minHeight: 52,
    justifyContent: "center",
    ...cardShadow,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    borderRadius: 16,
    minHeight: 46,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
});
