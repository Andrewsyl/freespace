import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CircleCheck,
  CircleParking,
  House,
  Minus,
  Plus,
  Signpost,
  Warehouse,
  Info,
} from "lucide-react-native";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingDetails: undefined;
  ListingFeaturesAccess: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingDetails">;

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
const SOFT = hostFlowColors.textSoft;
const CARD_SHADOW = {
  shadowColor: "#2d1a0e",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
} as const;

const spaceTypes = ["Private Driveway", "Garage", "Car park", "Private road"];
const vehicleSizeOptions = [
  { value: "small",  label: "Hatchback",  example: "Small & city cars",            image: "https://img.icons8.com/color/96/hatchback.png" },
  { value: "medium", label: "Saloon",     example: "Saloons & family cars",        image: "https://img.icons8.com/color/96/sedan.png" },
  { value: "large",  label: "SUV / Jeep", example: "SUVs, jeeps & 4x4s",          image: "https://img.icons8.com/color/96/suv.png" },
  { value: "van",    label: "Van",        example: "Vans, minibuses & campervans", image: "https://img.icons8.com/color/96/van.png" },
];

type DetailStep = "type" | "count" | "vehicle";

const MIN_SPACE_COUNT = 0;
const MAX_SPACE_COUNT = 99;

function parseSpaceCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_SPACE_COUNT) return null;
  return Math.min(parsed, MAX_SPACE_COUNT);
}

function SpaceTypeIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? ACCENT : FG;
  const size = 20;
  const strokeWidth = 1.8;
  switch (type) {
    case "Private Driveway": return <House size={size} color={color} strokeWidth={strokeWidth} />;
    case "Garage":           return <Warehouse size={size} color={color} strokeWidth={strokeWidth} />;
    case "Car park":         return <CircleParking size={size} color={color} strokeWidth={strokeWidth} />;
    default:                 return <Signpost size={size} color={color} strokeWidth={strokeWidth} />;
  }
}

export function ListingDetailsScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();
  const [openStep, setOpenStep] = useState<DetailStep>(() => {
    if (!draft.spaceType) return "type";
    if (!draft.spaceCount) return "count";
    return "vehicle";
  });
  const [spaceCountInput, setSpaceCountInput] = useState<number>(
    () => parseSpaceCount(draft.spaceCount) ?? MIN_SPACE_COUNT
  );
  const canContinue = Boolean(draft.spaceType) && Boolean(draft.spaceCount) && Boolean(draft.vehicleSize);
  const confirmedSpaceCount = parseSpaceCount(draft.spaceCount);
  const hasConfirmedCount = confirmedSpaceCount !== null && confirmedSpaceCount > 0;

  useEffect(() => {
    if (!draft.spaceType) { setOpenStep("type"); return; }
    if (!draft.spaceCount) { setOpenStep("count"); return; }
    if (!draft.vehicleSize) { setOpenStep("vehicle"); return; }
  }, [draft.spaceCount, draft.spaceType, draft.vehicleSize]);

  useEffect(() => {
    if (confirmedSpaceCount !== null && confirmedSpaceCount > 0) {
      setSpaceCountInput(confirmedSpaceCount);
    } else if (!draft.spaceType) {
      setSpaceCountInput(MIN_SPACE_COUNT);
    }
  }, [confirmedSpaceCount, draft.spaceType]);

  const adjustSpaceCount = (delta: number) => {
    const next = Math.min(MAX_SPACE_COUNT, Math.max(MIN_SPACE_COUNT, spaceCountInput + delta));
    setSpaceCountInput(next);
    setDraft((current) => ({ ...current, spaceCount: next > 0 ? String(next) : "", capacity: next > 0 ? next : 1 }));
    setOpenStep(next > 0 ? "vehicle" : "count");
  };

  const showTypeSection  = !draft.spaceType || openStep === "type";
  const showTypeRow      = draft.spaceType && openStep !== "type";
  const showCountSection = Boolean(draft.spaceType);
  const showVehicleSection = draft.spaceType && hasConfirmedCount;

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={3} total={8} onClose={exitFlow} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerCardTop}>
            <Text style={styles.headerKicker}>Step 3 · Space details</Text>
            <Text style={styles.headerTitle}>Tell us about your space</Text>
          </View>
          <View style={styles.headerCardBottom}>
            <Text style={styles.headerSubtitle}>This helps drivers know if your space is the right fit for them.</Text>
          </View>
        </View>

        {/* ── Space type card ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Space type</Text>
          <View style={styles.cardBody}>
            {showTypeSection && (
              <>
                <Text style={styles.cardPrompt}>Pick the option that best matches your space</Text>
                <View style={styles.typeGrid}>
                  {spaceTypes.map((type) => {
                    const active = draft.spaceType === type;
                    return (
                      <Pressable
                        key={type}
                        style={[styles.typeCard, active && styles.typeCardActive]}
                        onPress={() => {
                          setDraft((prev) => ({ ...prev, spaceType: type }));
                          setOpenStep("count");
                        }}
                      >
                        <View style={styles.typeCardTop}>
                          <View style={[styles.typeIconWrap, active && styles.typeIconWrapActive]}>
                            <SpaceTypeIcon type={type} active={active} />
                          </View>
                          {active && (
                            <CircleCheck size={18} color={ACCENT} strokeWidth={2.5} />
                          )}
                        </View>
                        <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{type}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {showTypeRow && (
              <Pressable
                style={styles.selectedTypeRow}
                onPress={() => setOpenStep("type")}
              >
                <View style={[styles.typeIconWrap, styles.typeIconWrapActive]}>
                  <SpaceTypeIcon type={draft.spaceType} active />
                </View>
                <Text style={styles.selectedTypeLabel}>{draft.spaceType}</Text>
                <CircleCheck size={18} color={ACCENT} strokeWidth={2.5} />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Space count card ── */}
        {showCountSection && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Number of spaces</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardPrompt}>
                The number of individual spaces you're making available to rent.
              </Text>
              <View style={styles.counterRow}>
                <Pressable
                  style={[styles.counterButton, spaceCountInput <= MIN_SPACE_COUNT && styles.counterButtonDisabled]}
                  onPress={() => adjustSpaceCount(-1)}
                  disabled={spaceCountInput <= MIN_SPACE_COUNT}
                >
                  <Minus size={20} color={FG} strokeWidth={2.5} />
                </Pressable>
                <View style={styles.counterValueBox}>
                  <Text style={styles.counterValueText}>{spaceCountInput}</Text>
                </View>
                <Pressable
                  style={[styles.counterButton, spaceCountInput >= MAX_SPACE_COUNT && styles.counterButtonDisabled]}
                  onPress={() => adjustSpaceCount(1)}
                  disabled={spaceCountInput >= MAX_SPACE_COUNT}
                >
                  <Plus size={20} color={FG} strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* ── Vehicle fit card ── */}
        {showVehicleSection && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Vehicle fit</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardPrompt}>What size vehicles fit comfortably in your space?</Text>
              <View style={styles.vehicleList}>
                {vehicleSizeOptions.map((option) => {
                  const active = draft.vehicleSize === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.vehicleCard, active && styles.vehicleCardActive]}
                      onPress={() => {
                        setDraft((prev) => ({ ...prev, vehicleSize: option.value }));
                      }}
                    >
                      <View style={styles.vehicleTextWrap}>
                        <Text style={[styles.vehicleTitle, active && styles.vehicleTitleActive]}>
                          {option.label}
                        </Text>
                        <Text style={styles.vehicleExample}>{option.example}</Text>
                      </View>
                      <View style={styles.vehicleArtWrap}>
                        <Image
                          source={{ uri: option.image }}
                          style={styles.vehicleArtImage}
                          resizeMode="contain"
                        />
                      </View>
                      {active && (
                        <View style={styles.vehicleCheckBadge}>
                          <CircleCheck size={18} color={ACCENT} strokeWidth={2.4} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Tips card — only shown once all three sections are complete */}
        {canContinue && <View style={styles.tipsCard}>
          <View style={styles.tipsRow}>
            <Info size={15} color={ACCENT} strokeWidth={2.2} />
            <Text style={styles.tipsTitle}>Accuracy matters</Text>
          </View>
          <Text style={styles.tipsBody}>
            Accurate space details help drivers know if your spot is right for their vehicle — reducing cancellations and improving your rating.
          </Text>
        </View>}
      </ScrollView>

      <FlowFooter
        onBack={() => navigation.goBack()}
        primaryLabel="Continue"
        onPrimary={() => navigation.navigate("ListingFeaturesAccess")}
        primaryDisabled={!canContinue}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8FAFC",
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },

  // ── Header card (matches location screen style) ──────────────
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D0C9C1",
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

  // ── Cards ────────────────────────────────────────────────────
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D0C9C1",
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
    borderBottomColor: "#E2DAD2",
  },
  cardBody: {
    padding: 16,
  },
  cardPrompt: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },

  // ── Space type grid ──────────────────────────────────────────
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8ED",
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 14,
    width: "48%",
  },
  typeCardActive: {
    borderColor: ACCENT,
    backgroundColor: hostFlowColors.accentSoft,
  },
  typeCardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  typeIconWrap: {
    alignItems: "center",
    backgroundColor: "#EDF7F2",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  typeIconWrapActive: {
    backgroundColor: hostFlowColors.accentSoftBorder,
  },
  typeLabel: {
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  typeLabelActive: {
    color: ACCENT,
  },

  // ── Selected type row ────────────────────────────────────────
  selectedTypeRow: {
    alignItems: "center",
    backgroundColor: hostFlowColors.accentSoft,
    borderColor: ACCENT,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectedTypeLabel: {
    color: FG,
    flex: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
  },

  // ── Counter ──────────────────────────────────────────────────
  counterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  counterButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8ED",
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  counterButtonDisabled: {
    opacity: 0.35,
  },
  counterValueBox: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8ED",
    borderRadius: 12,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 72,
  },
  counterValueText: {
    color: FG,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 24,
    letterSpacing: -0.5,
  },

  // ── Vehicle size cards ───────────────────────────────────────
  vehicleList: {
    gap: 10,
  },
  vehicleCard: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8ED",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 72,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: "relative",
  },
  vehicleCardActive: {
    borderColor: ACCENT,
    backgroundColor: hostFlowColors.accentSoft,
  },
  vehicleTextWrap: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 8,
  },
  vehicleTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  vehicleTitleActive: {
    color: ACCENT,
  },
  vehicleExample: {
    color: SOFT,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  vehicleArtWrap: {
    alignItems: "flex-end",
    flexShrink: 0,
    justifyContent: "center",
    width: 80,
  },
  vehicleArtImage: {
    height: 44,
    width: 80,
  },
  vehicleCheckBadge: {
    position: "absolute",
    right: 14,
    top: 12,
  },

  // ── Tips card ────────────────────────────────────────────────
  tipsCard: {
    backgroundColor: "#F0FDF8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#C6F0DC",
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
