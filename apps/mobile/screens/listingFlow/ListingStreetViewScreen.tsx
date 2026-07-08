import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { FlowHeader } from "./FlowHeader";
import { useListingFlow } from "./context";
import { hostFlowColors } from "./hostFlowTheme";
import { colors } from "../../styles/theme";
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
  const [panoAvailable, setPanoAvailable] = useState(true);
  const canUseView = Platform.OS !== "web" && !!mapsKey;
  const centerLat = draft.location.latitude;
  const centerLng = draft.location.longitude;
  const initialHeading = draft.coverHeading ?? 0;
  const initialPitch = draft.coverPitch ?? 0;
  const initialPanoId = draft.coverPanoId ?? null;

  // Re-open at the panorama the host previously navigated to (if they moved
  // down the road), not the listing's fixed address — otherwise every re-open
  // discards that movement and starts back at the address's own panorama.
  const initialPositionJs = initialPanoId
    ? `pano: ${JSON.stringify(initialPanoId)}`
    : `position: { lat: ${centerLat}, lng: ${centerLng} }`;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          html, body, #pano { margin: 0; padding: 0; width: 100%; height: 100%; background: ${hostFlowColors.text}; }
        </style>
        <script src="https://maps.googleapis.com/maps/api/js?key=${mapsKey}"></script>
      </head>
      <body>
        <div id="pano"></div>
        <script>
          const pano = new google.maps.StreetViewPanorama(document.getElementById("pano"), {
            ${initialPositionJs},
            pov: { heading: ${initialHeading}, pitch: ${initialPitch} },
            zoom: 0,
            motionTracking: false,
            fullscreenControl: false,
            addressControl: false,
            showRoadLabels: false
          });
          // Capture panoId too, not just heading/pitch — moving down the road
          // changes which panorama is showing, and heading/pitch alone can't
          // reproduce that; the pano ID pins the exact spot the host chose.
          window.__getPov = () => ({ ...pano.getPov(), panoId: pano.getPano() });
          function reportStatus() {
            var ok = pano.getStatus ? pano.getStatus() === "OK" : true;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: "status", ok: ok }));
          }
          google.maps.event.addListener(pano, "status_changed", reportStatus);
          setTimeout(reportStatus, 1500);
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
      <FlowHeader current={2} total={9} onClose={exitFlow} />

      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.headerCardTop}>
          <Text style={styles.headerKicker}>Step 2 · Street view</Text>
          <Text style={styles.headerTitle}>Choose your cover image</Text>
        </View>
        <View style={styles.headerCardBottom}>
          <Text style={styles.headerSubtitle}>
            Drag to find the best angle. If the view isn't clear, you can add your own photos later.
          </Text>
        </View>
      </View>
      <Pressable
        style={styles.skipButton}
        onPress={() => {
          setDraft((prev) => ({ ...prev, coverHeading: null, coverPitch: null, coverPanoId: null }));
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
                  ok?: boolean;
                  pov?: { heading: number; pitch: number; panoId?: string | null };
                };
                if (payload.type === "status") {
                  setPanoAvailable((payload as { ok?: boolean }).ok !== false);
                  return;
                }
                if (payload.type === "pov" && payload.pov) {
                  const { pov } = payload;
                  setDraft((prev) => ({
                    ...prev,
                    coverHeading: Math.round(pov.heading),
                    coverPitch: Math.round(pov.pitch),
                    coverPanoId: pov.panoId ?? null,
                  }));
                  navigation.navigate("ListingDetails");
                }
              } catch {
                // Ignore invalid messages.
              }
            }}
          />
        )}
        {!panoAvailable ? (
          <View style={styles.noPanoOverlay}>
            <Text style={styles.webFallbackText}>
              No Street View coverage here. Skip this step — you can add your own photos later.
            </Text>
          </View>
        ) : Platform.OS !== "web" ? (
          <View style={styles.hintWrap} pointerEvents="none">
            <View style={styles.hintPill}>
              <Text style={styles.hintText}>Drag until your space is in view, then tap Use this view</Text>
            </View>
          </View>
        ) : null}
      </View>

      <FlowFooter
        onBack={() => navigation.goBack()}
        primaryLabel={canUseView && !panoAvailable ? "Continue without Street View" : "Use this view"}
        onPrimary={() => {
          // No panorama at this address: don't strand the host on a dead button —
          // clear any cover fields and move on so they add their own photos next.
          if (canUseView && !panoAvailable) {
            setDraft((prev) => ({ ...prev, coverHeading: null, coverPitch: null, coverPanoId: null }));
            navigation.navigate("ListingDetails");
            return;
          }
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
    backgroundColor: hostFlowColors.bg,
    flex: 1,
  },

  headerCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  headerCardTop: {
    borderBottomColor: hostFlowColors.border,
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
    backgroundColor: hostFlowColors.bg,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  noPanoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hostFlowColors.bg,
    padding: 24,
  },
  hintWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  hintPill: {
    backgroundColor: "rgba(15, 23, 42, 0.68)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  hintText: {
    color: colors.textInverse,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: 0.1,
    textAlign: "center",
  },
  webFallbackText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
