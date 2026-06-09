import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { FlowHeader } from "./FlowHeader";
import { useListingFlow } from "./context";
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingStreetView: undefined;
  ListingDetails: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingStreetView">;

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
const CARD_SHADOW = {
  shadowColor: "#2d1a0e",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
} as const;

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

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={2} total={8} onClose={exitFlow} />

      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.headerCardTop}>
          <Text style={styles.headerKicker}>Step 2 · Street view</Text>
          <Text style={styles.headerTitle}>Choose your cover image</Text>
        </View>
        <View style={styles.headerCardBottom}>
          <Text style={styles.headerSubtitle}>
            Drag to find the best angle. If the view isn't clear, add your own photos in the next step.
          </Text>
        </View>
      </View>
      <Pressable
        style={styles.skipButton}
        onPress={() => {
          setDraft((prev) => ({ ...prev, coverHeading: null }));
          navigation.navigate("ListingDetails");
        }}
      >
        <Text style={styles.skipButtonText}>Skip for now →</Text>
      </Pressable>

      {/* Viewer card */}
      <View style={styles.viewerCard}>
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

      <FlowFooter
        onBack={() => navigation.goBack()}
        primaryLabel="Use this view"
        onPrimary={() => {
          if (Platform.OS === "web") {
            navigation.navigate("ListingDetails");
            return;
          }
          const script =
            "window.ReactNativeWebView.postMessage(JSON.stringify({type:'pov', pov: window.__getPov ? window.__getPov() : null})); true;";
          webViewRef.current?.injectJavaScript(script);
        }}
        primaryDisabled={!canUseView}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8FAFC",
    flex: 1,
  },

  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D0C9C1",
    marginHorizontal: 16,
    marginTop: 12,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  headerCardTop: {
    borderBottomColor: "#E2DAD2",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerKicker: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 18,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  headerCardBottom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSubtitle: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  skipButton: {
    marginTop: 6,
    marginHorizontal: 16,
    paddingVertical: 4,
  },
  skipButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: ACCENT,
  },

  viewerCard: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
    borderRadius: 18,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  webView: {
    flex: 1,
  },
  webFallback: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  webFallbackText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
