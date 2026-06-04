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
import { FlowHeader } from "./FlowHeader";
import { useListingFlow } from "./context";
import { hostFlowColors } from "./hostFlowTheme";
import { colors, spacing } from "../../styles/theme";
import { FlowFooter } from "./FlowFooter";

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

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={2} total={8} onClose={exitFlow} />
      <View style={styles.header}>
        <Text style={styles.kicker}>Street view</Text>
        <Text style={styles.title}>Choose your cover image</Text>
        <Text style={styles.hint}>
          Can't see your space from here? You can add your own photos at a later step.
        </Text>
        <Pressable
          style={styles.skipButton}
          onPress={() => {
            setDraft((prev) => ({ ...prev, coverHeading: null }));
            navigation.navigate("ListingDetails");
          }}
        >
          <Text style={styles.skipButtonText}>Skip for now →</Text>
        </Pressable>
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
    backgroundColor: colors.appBg,
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenX,
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
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 26,
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: 10,
  },
  hint: {
    backgroundColor: hostFlowColors.accentSoft,
    borderColor: hostFlowColors.accentSoftBorder,
    borderRadius: 10,
    borderWidth: 1,
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipButton: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  skipButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: hostFlowColors.accent,
  },
  viewer: {
    flex: 1,
    marginTop: 16,
    marginBottom: 16,
    marginHorizontal: spacing.screenX,
    borderRadius: 12,
    overflow: "hidden",
    borderColor: colors.border,
    borderWidth: 1,
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
    fontFamily: "PlusJakartaSans-Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
