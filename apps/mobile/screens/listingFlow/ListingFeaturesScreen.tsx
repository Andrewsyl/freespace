import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Accessibility,
  ArrowUpDown,
  BatteryCharging,
  Bike,
  Cctv,
  CircleCheck,
  Clock,
  Fence,
  Lightbulb,
  Lock,
  Maximize2,
  Warehouse,
} from "lucide-react-native";
import { FlowHeader } from "./FlowHeader";
import { useListingFlow } from "./context";
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingFeatures: { fromReview?: boolean } | undefined;
  ListingAccess: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingFeatures">;

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

function featureIcon(name: string, active: boolean) {
  const color = active ? ACCENT : hostFlowColors.textMuted;
  const props = { size: 20, color, strokeWidth: 1.8 };
  switch (name) {
    case "CCTV":               return <Cctv {...props} />;
    case "EV charging":        return <BatteryCharging {...props} />;
    case "Sheltered":          return <Warehouse {...props} />;
    case "Well lit":           return <Lightbulb {...props} />;
    case "Gated access":       return <Fence {...props} />;
    case "Single entry":       return <Lock {...props} />;
    case "Height-friendly":
    case "Height restricted":  return <ArrowUpDown {...props} />;
    case "Disabled access":    return <Accessibility {...props} />;
    case "24/7 access":        return <Clock {...props} />;
    case "Motorbike friendly": return <Bike {...props} />;
    case "Wide bay":           return <Maximize2 {...props} />;
    default:                   return <Warehouse {...props} />;
  }
}

const PRIMARY_FEATURES = ["CCTV", "EV charging", "Sheltered", "Well lit", "Gated access"];
const EXTRA_FEATURES   = ["Single entry", "Height restricted", "Disabled access", "24/7 access", "Motorbike friendly", "Wide bay"];

export function ListingFeaturesScreen({ navigation, route }: Props) {
  const { draft, setDraft } = useListingFlow();
  const fromReview = route.params?.fromReview ?? false;
  const insets = useSafeAreaInsets();
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const visibleFeatures = showAllFeatures
    ? [...PRIMARY_FEATURES, ...EXTRA_FEATURES]
    : PRIMARY_FEATURES;

  const toggleFeature = (option: string) => {
    setDraft((prev) => {
      const exists = prev.accessOptions.includes(option);
      return {
        ...prev,
        accessOptions: exists
          ? prev.accessOptions.filter((item) => item !== option)
          : [...prev.accessOptions, option],
      };
    });
  };

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={4} total={9} onClose={exitFlow} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerCardTop}>
            <Text style={styles.headerKicker}>Step 4 · Features</Text>
            <Text style={styles.headerTitle}>What features does your space have?</Text>
          </View>
          <View style={styles.headerCardBottom}>
            <Text style={styles.headerSubtitle}>
              Optional — highlight anything that helps drivers choose your space. You can add these later too.
            </Text>
          </View>
        </View>

        {/* ── Features card ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Features</Text>
          <View style={styles.cardBody}>
            <View style={styles.chipGrid}>
              {visibleFeatures.map((option) => {
                const active = draft.accessOptions.includes(option);
                return (
                  <Pressable
                    key={option}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleFeature(option)}
                  >
                    <View style={[styles.chipIconWrap, active && styles.chipIconWrapActive]}>
                      {featureIcon(option, active)}
                    </View>
                    <Text
                      style={[styles.chipLabel, active && styles.chipLabelActive]}
                      numberOfLines={1}
                    >
                      {option}
                    </Text>
                    {active ? (
                      <CircleCheck size={16} color={ACCENT} strokeWidth={2.2} style={styles.chipCheck} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.showMoreBtn} onPress={() => setShowAllFeatures((v) => !v)}>
              <Text style={styles.showMoreText}>
                {showAllFeatures ? "Show fewer features ↑" : `More features (${EXTRA_FEATURES.length}) ↓`}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <FlowFooter
        onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
        primaryLabel={fromReview ? "Save changes" : "Continue"}
        onPrimary={() => navigation.navigate(fromReview ? "ListingReview" : "ListingAccess")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hostFlowColors.bg },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },

  // ── Header card ──────────────────────────────────────────────
  headerCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
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

  // ── Card ─────────────────────────────────────────────────────
  card: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  cardHeader: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 15,
    letterSpacing: -0.3,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: hostFlowColors.border,
  },
  cardBody: {
    padding: 16,
  },

  // ── Feature chips ────────────────────────────────────────────
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    // Two per row (≈half width, 8px gap) so the feature list stays compact.
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    minHeight: 60,
    paddingHorizontal: 10,
    paddingVertical: 12,
    paddingRight: 24,
    backgroundColor: hostFlowColors.bg,
    position: "relative",
  },
  chipActive: {
    borderColor: ACCENT,
    backgroundColor: hostFlowColors.accentSoft,
  },
  chipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hostFlowColors.accentSoft,
    flexShrink: 0,
  },
  chipIconWrapActive: {
    backgroundColor: hostFlowColors.accentSoftBorder,
  },
  chipLabel: {
    flex: 1,
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
    lineHeight: 17,
  },
  chipLabelActive: {
    color: ACCENT,
  },
  chipCheck: {
    position: "absolute",
    right: 8,
    top: 8,
  },

  showMoreBtn: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.bg,
  },
  showMoreText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: MUTED,
  },

  // ── Tips card ────────────────────────────────────────────────
  tipsCard: {
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
    padding: 16,
  },
  tipsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  tipsTitle: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  tipsBody: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
});
